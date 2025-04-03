import 'server-only';
import { getRandomFile } from '@/app/api/random';
import {
  createAI,
  getMutableAIState,
  getAIState,
  render,
  createStreamableValue
} from 'ai/rsc';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { nanoid } from '@/lib/utils';
import { saveChat } from '@/app/actions';
import { SpinnerMessage, UserMessage, BotMessage } from '@/components/message';
import { Chat } from '@/lib/types';
import { auth } from '@/auth';
import path from "path";
import fs from "fs";

const googleAI = new GoogleGenerativeAI(process.env.GOOGLEAI_API_KEY || '');
const model = googleAI.getGenerativeModel({ model: process.env.GOOGLEAI_MODEL || 'gemini-2.0-pro-exp-02-05' });

async function getMedicalQuestions() {
  try {
    console.log('Caricamento domande...');
    const data = await getRandomFile();
    if (!data || !Array.isArray(data)) {
      throw new Error('Formato dati non valido');
    }
    return data;
  } catch (error) {
    console.error('Errore nel caricamento delle domande:', error);
    return [];
  }
}

async function getProblemDetails() {
  try {
    const directoryPath = path.join(process.cwd(), 'app/api/data/cartellaTALD');
    const files = await fs.promises.readdir(directoryPath);
    const jsonFile = files.find(file => file === 'jsonTald.json');
    if (!jsonFile) throw new Error('File jsonTald.json non trovato');
    const filePath = path.join(directoryPath, jsonFile);
    const fileData = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(fileData).transcription;
  } catch (error) {
    console.error('Errore nel caricamento del file JSON:', error);
    throw error;
  }
}

const chatSessions = new Map();

async function submitUserMessage(content, type) {
  'use server';

  const aiState = getMutableAIState();
  const messages = aiState.get().messages;
  const chatId = aiState.get().chatId;

  const botMessageCount = messages.filter(msg => msg.role === 'assistant').length;
  const firstInteractionDone = botMessageCount > 0;

  let chatSession = chatSessions.get(chatId);
  if (!chatSession) {
    chatSession = model.startChat({});
    chatSessions.set(chatId, chatSession);
  }

  aiState.update({
    ...aiState.get(),
    messages: [...messages, { id: nanoid(), role: 'user', content }]
  });

  let prompt;
  if (!firstInteractionDone) {
    prompt = `Chiedimi nome e data di nascita in modo professionale senza aggiungere dettagli superflui.`;
  } else if (content.trim().toUpperCase() === "FORNISCI I RISULTATI DELL'INTERVISTA") {
    const problemDetails = await getProblemDetails();
    const chosenPhenomenon = problemDetails[0];//con 0 selezioni Perseveration
    prompt = `
    - Problematica: ${chosenPhenomenon.fenomeno}
    - Descrizione: ${chosenPhenomenon.descrizione}
    - Esempio: ${chosenPhenomenon.esempio}
    - Punteggio TLDS: ${chosenPhenomenon.punteggio}
    **Valuta la presenza della problematica all'interno della conversazione avuta finora col paziente, usando il seguente modello:**
    - Modello di output: ${chosenPhenomenon.modello_di_output}
    `;
  } else {
    const questions = await getMedicalQuestions();
    const formattedQuestions = questions.join('\n- ');
    prompt = `RISPOSTA PAZIENTE: ${content}

### Cosa devi fare:
1. Fase di controllo prima di considerare il punto 2:
   - Il paziente ha fornito **sia il nome che la data di nascita, altrimenti, richiedigli queste informazioni prima di procedere.
   - Controlla la risposta del paziente, se ha ha fatto una richiesta di chiarimento o altro rispondi.
2. Scegli una sola domanda tra quelle elencate: considera solo le domande e non le affermazioni:
   - ${formattedQuestions}  
   -DA ESCLUDERE: domanda del nome, affermazioni come "va bene" "grazie" e altre cose di questo tipo.
   - Se necessario, riformula la domanda per renderla più chiara. 
   - Considera il contesto, ci sono domande adatte solo dopo aver fatto altre domande
   - Non considerare le affermazioni, devi scegliere una domanda tra le frasi disponibili.
   - Non ripetere mai domande già fatte. Se non ci sono domande nuove, inventane una pertinente.  
    ⚠ IMPORTANTE: Scrivi solo il messaggio, senza spiegare le modifiche fatte.`;
  }
  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode
  const response = await chatSession.sendMessage(prompt);
  const messageContent = response.response?.text() || 'Nessuna risposta valida.';
  if (!textStream) {
    textStream = createStreamableValue('')
    textNode = <BotMessage content={textStream.value} />
  }
    textStream.update(messageContent)
  textStream.done()
console.log('🟡 Sto per chiamare done()...');
aiState.done({
  ...aiState.get(),
  messages: [...aiState.get().messages, { id: nanoid(), role: 'assistant', content: messageContent }]
});
console.log('🟢 done() è stata chiamata!');

   return {
    id: nanoid(),
    display: textNode
  }
}

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'data';
  content: string;
  id: string;
  name?: string;
};

export type AIState = {
  chatId: string;
  messages: Message[];
};

export type UIState = {
  id: string;
  display: React.ReactNode;
}[];

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  unstable_onGetUIState: async () => {
    'use server';
    const session = await auth();
    if (session && session.user) {
      const aiState = getAIState();
      if (aiState) {
        const uiState = getUIStateFromAIState(aiState);
        return uiState;
      }
    } else {
      return;
    }
  },
   unstable_onSetAIState: async ({ state, done }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`
      const title = messages[0].content.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: AIState) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'user' ? (
          <UserMessage>{message.content}</UserMessage>
        ) : (
          <BotMessage content={message.content} />
        )
    }));
};
