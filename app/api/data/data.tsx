import fs from 'fs';
import path from 'path';

// Funzione per ottenere un file JSON casuale dalla cartella
function getRandomFileFromFolder(folderPath: string): string {
  const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.json'));
  const randomIndex = Math.floor(Math.random() * files.length);
  return files[randomIndex];
}

// Funzione per caricare il contenuto di un file JSON
function loadJSONFile(filePath: string): any {
  const rawData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(rawData);
}

// Funzione principale per estrarre le domande del medico
export function getMedicalQuestions() {
  const folderPath = path.join(__dirname, 'cartellaTrascrizioni');

  // Seleziona un file JSON casuale dalla cartella
  const randomFile = getRandomFileFromFolder(folderPath);
  const filePath = path.join(folderPath, randomFile);

  // Carica il contenuto del file JSON
  const data = loadJSONFile(filePath);

  // Filtra e restituisce solo le domande fatte dal medico
  return data.transcription
    .filter((entry: { role: string }) => entry.role === 'medico')
    .map((entry: { text: string }) => entry.text);
}
