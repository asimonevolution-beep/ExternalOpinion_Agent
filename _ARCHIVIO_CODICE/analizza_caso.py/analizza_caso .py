import os
import json
from ollama import generate

def esegui_analisi_agente(nome_cartella_caso):
    # 1. Definiamo i percorsi all'interno della struttura v1.0
    percorso_base = os.path.join("CASES_ACTIVE", nome_cartella_caso)
    percorso_input = os.path.join(percorso_base, "INPUT")
    percorso_output = os.path.join(percorso_base, "OUTPUT")
    
    # 2. Leggiamo i dati di base inseriti da te
    file_dati = os.path.join(percorso_input, "dati_base.txt")
    if not os.path.exists(file_dati):
        print(f"❌ Errore: Non trovo il file dati_base.txt in {percorso_input}")
        return
        
    with open(file_dati, "r", encoding="utf-8") as f:
        dati_immobile = f.read()
        
    # 3. Recuperiamo il testo del prompt operativo standardizzato v…