from langchain_core.output_parsers import PydanticOutputParser
from google.generativeai import Client as GoogleGenerativeAI  # Usando GoogleGenerativeAI, adattato alla tua libreria
from generation.generation_template import GenerationModel
from dotenv import load_dotenv
import os
import json
import argparse
import logging

# Load dotenv
load_dotenv()

data_path = os.path.join(os.path.dirname(
    os.path.abspath('.env')), os.getenv('DATA_PATH'))
out_path = os.path.join(os.path.dirname(
    os.path.abspath('.env')), os.getenv('OUT_PATH'))

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Funzione per controllare se l'oggetto è JSON serializzabile
def is_json_serializable(obj):
    try:
        json.dumps(obj)
        return True
    except (TypeError, OverflowError):
        return False


# Funzione per generare il chain usando il modello di Google
def generate_chain(transcript_file, out_file):
    with open(os.path.join(data_path, transcript_file), 'r') as f:
        lines = f.readlines()

    query = "Based on the therapy session transcript, summarize the patient's personal history following the below instructions. Not that `Client` means the patient in the transcript.\n\n{lines}".format(
        lines=lines)

    pydantic_parser = PydanticOutputParser(
        pydantic_object=GenerationModel.CognitiveConceptualizationDiagram)

    _input = GenerationModel.prompt_template.invoke({
        "query": query,
        "format_instructions": pydantic_parser.get_format_instructions()
    })

    # Creiamo un client per Google Generative AI
    google_ai_client = GoogleGenerativeAI(api_key=os.getenv('GOOGLE_API_KEY'))  # Usa la chiave API di Google

    attempts = 0
    while attempts < int(os.getenv('MAX_ATTEMPTS')):
        try:
            # Usa il client per invocare il modello di Google AI
            google_response = google_ai_client.generate_text(_input)  # Presumiamo che `generate_text` sia il metodo per invocare la generazione

            # Parsing della risposta con il PydanticOutputParser
            _output = pydantic_parser.parse(google_response).model_dump()
            print(_output)

            if is_json_serializable(_output):
                with open(os.path.join(out_path, out_file), 'w') as f:
                    f.write(json.dumps(_output, indent=4))
                logger.info(f"Output successfully written to {out_file}")
                break
            else:
                attempts += 1
                logger.warning(
                    f"Output is not JSON serializable. Attempting {attempts}/{int(os.getenv('MAX_ATTEMPTS'))}")
                if attempts == int(os.getenv('MAX_ATTEMPTS')):
                    logger.error(
                        "Max attempts reached. Could not generate a JSON serializable output.")
                    raise ValueError(
                        "Could not generate a JSON serializable output after maximum attempts.")
        except Exception as e:
            attempts += 1
            logger.error(f"Error during API call: {e}")
            if attempts == int(os.getenv('MAX_ATTEMPTS')):
                logger.error("Max attempts reached, could not generate output from Google AI.")
                raise


# Funzione principale
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--transcript-file', type=str,
                        default="example_transcript.txt")
    parser.add_argument('--out-file', type=str,
                        default="example_CCD_from_transcript.json")
    args = parser.parse_args()
    generate_chain(args.transcript_file, args.out_file)


if __name__ == "__main__":
    main()
