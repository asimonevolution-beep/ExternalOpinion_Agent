/**
 * EXTERNAL OPINION — SCRIPT DI TEST INTEGRATO (P0)
 * Direzione Tecnica: Geometra Simone Azzali
 */
const { createAnalysisPipeline } = require('./dag-orchestrator');

const payloadEsempio = {
  url: "https://www.immobiliare.it/annunci/esempio-san-damaso",
  parametriMercato: {
    valoreOMI: 2100,      // €/mq zona San Damaso / Modena
    trendZona: 0.02,      // +2% annuo
    anniProiezione: 5
  },
  datiAI: {
    costiSanatoria: 3500,
    costiRipristino: 12000,
    statoImmobile: "STATO_BUONO",
    difformita: {
      strutturale: false,
      urbanistica: true,  // Genererà una penalità nel motore deterministico
      catastale: false
    }
  },
  metadata: {
    userId: "user_test_01",
    generatoDa: "Console Test Autonomo"
  }
};

async function eseguiTest() {
  console.log("[TEST] Avvio pipeline sincrona in-process...");
  console.time("Durata Totale Pipeline");
  
  try {
    const infoFlusso = await createAnalysisPipeline(payloadEsempio, 'TIER_1_ENTRY_89');
    console.log("[TEST] Pipeline inizializzata con successo!");
    console.log("[TEST] Job ID Generato:", infoFlusso.job.id);
    
    // Attendiamo 3 secondi per dare tempo alla pipeline asincrona (IIFE) di completare tutti gli step nei log
    setTimeout(() => {
      console.timeEnd("Durata Totale Pipeline");
      console.log("[TEST] Controlla i log sopra per verificare il passaggio tra SCRAPE -> OCR -> LLM -> SCORING -> REPORT -> REVIEW -> NOTIFY.");
      process.exit(0);
    }, 3000);

  } catch (error) {
    console.error("[TEST CRITICO] Fallimento del test:", error.message);
    process.exit(1);
  }
}

eseguiTest();