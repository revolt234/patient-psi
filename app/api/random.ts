'use server'
import fs from 'fs';
import path from 'path';

// Funzione per ottenere un file JSON casuale dalla cartella
export const getRandomFile = () => {
  const directoryPath = path.join(process.cwd(), 'app/api/data/cartellaTrascrizioni'); // Percorso della cartella
  try {
    console.log(`Leggendo i file dalla cartella: ${directoryPath}`); // Stampa il percorso della cartella
    const files = fs.readdirSync(directoryPath); // Leggi i file nella cartella

    if (files.length === 0) {
      throw new Error('La cartella è vuota');
    }

    // Seleziona un file casuale
    const randomFile = files[Math.floor(Math.random() * files.length)];
    console.log(`File selezionato: ${randomFile}`); // Stampa il nome del file selezionato

    // Controlla se il file è JSON (opzionale, per evitare la lettura di file non JSON)
    if (!randomFile.endsWith('.json')) {
      throw new Error('Il file selezionato non è un file JSON');
    }

    const filePath = path.join(directoryPath, randomFile); // Percorso completo del file
    console.log(`Percorso completo del file: ${filePath}`); // Stampa il percorso completo del file

    const fileContent = fs.readFileSync(filePath, 'utf-8'); // Leggi il contenuto del file
    console.log('File letto con successo'); // Conferma che il file è stato letto
    const jsonData = JSON.parse(fileContent); // Ritorna i dati JSON

    // Supponiamo che il file JSON contenga un array di domande del medico
    if (jsonData && Array.isArray(jsonData.transcription)) {
      // Estrai le domande del medico (per esempio, estrai solo le trascrizioni di tipo 'medico')
      const medicoQuestions = jsonData.transcription
        .filter((entry: { role: string, text: string }) => entry.role === 'medico')
        .map((entry: { text: string }) => entry.text);

      console.log('Domande del medico estratte:', medicoQuestions); // Log delle domande estratte

      return medicoQuestions; // Ritorna solo le domande del medico
    } else {
      throw new Error('Formato del file JSON non valido o domande non trovate');
    }
  } catch (error) {
    console.error('Errore durante la lettura del file:', error); // Aggiungi il log dell'errore
    throw error; // Rilancia l'errore per gestirlo nel GET
  }
};
