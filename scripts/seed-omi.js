/**
 * SEED OMI DATA — Mock data per Fase 0
 * Fonte: Agenzia Entrate OMI (Osservatorio Mercato Immobiliare)
 *
 * Uso:
 * node scripts/seed-omi.js
 */

const prisma = require('../db');

async function seedOmiData() {
  console.log('[OMI-SEED] Inizio importazione dati OMI mock...');

  // Dati OMI di esempio per zone principali italiane
  // Formato: { zona_catastale, provincia, comune, tipologia, prezzo_min_mq, prezzo_medio_mq, prezzo_max_mq }

  const omiData = [
    // MILANO (province MI)
    { zona: 'MI001', provincia: 'MI', comune: 'Milano', tipologia: 'Apartment', min: 4500, medio: 5200, max: 6500 },
    { zona: 'MI002', provincia: 'MI', comune: 'Milano', tipologia: 'House', min: 3800, medio: 4500, max: 5500 },
    { zona: 'MI003', provincia: 'MI', comune: 'Pero', tipologia: 'Apartment', min: 2800, medio: 3200, max: 3800 },
    { zona: 'MI004', provincia: 'MI', comune: 'Rozzano', tipologia: 'Apartment', min: 2500, medio: 2900, max: 3400 },

    // ROMA (province RM)
    { zona: 'RM001', provincia: 'RM', comune: 'Roma', tipologia: 'Apartment', min: 3200, medio: 4100, max: 5500 },
    { zona: 'RM002', provincia: 'RM', comune: 'Roma', tipologia: 'House', min: 3000, medio: 3800, max: 4800 },
    { zona: 'RM003', provincia: 'RM', comune: 'Frascati', tipologia: 'Apartment', min: 1800, medio: 2200, max: 2700 },
    { zona: 'RM004', provincia: 'RM', comune: 'Ciampino', tipologia: 'Apartment', min: 1600, medio: 2000, max: 2500 },

    // NAPOLI (province NA)
    { zona: 'NA001', provincia: 'NA', comune: 'Napoli', tipologia: 'Apartment', min: 1800, medio: 2400, max: 3200 },
    { zona: 'NA002', provincia: 'NA', comune: 'Napoli', tipologia: 'House', min: 1500, medio: 2000, max: 2700 },
    { zona: 'NA003', provincia: 'NA', comune: 'Casoria', tipologia: 'Apartment', min: 1200, medio: 1600, max: 2100 },
    { zona: 'NA004', provincia: 'NA', comune: 'Portici', tipologia: 'Apartment', min: 1100, medio: 1500, max: 2000 },

    // TORINO (province TO)
    { zona: 'TO001', provincia: 'TO', comune: 'Torino', tipologia: 'Apartment', min: 2500, medio: 3200, max: 4200 },
    { zona: 'TO002', provincia: 'TO', comune: 'Torino', tipologia: 'House', min: 2200, medio: 2800, max: 3600 },

    // BOLOGNA (province BO)
    { zona: 'BO001', provincia: 'BO', comune: 'Bologna', tipologia: 'Apartment', min: 3000, medio: 3800, max: 4800 },
    { zona: 'BO002', provincia: 'BO', comune: 'Bologna', tipologia: 'House', min: 2800, medio: 3500, max: 4400 },
  ];

  try {
    // Pulisci tabella precedente (solo per test)
    await prisma.omiData.deleteMany({});
    console.log('[OMI-SEED] Tabella pulita');

    let created = 0;
    for (const data of omiData) {
      try {
        await prisma.omiData.create({
          data: {
            zonaCatastale: data.zona,
            provincia: data.provincia,
            comune: data.comune,
            tipologia: data.tipologia,
            prezzoMinMq: data.min,
            prezzoMedioMq: data.medio,
            prezzoMaxMq: data.max,
            dataAggiornamento: new Date(),
          },
        });
        created++;
      } catch (e) {
        console.warn(`  ⚠️ Errore inserimento ${data.zona}:`, e.message);
      }
    }

    console.log(`[OMI-SEED] ✅ Importazione completata: ${created}/${omiData.length} record`);

  } catch (err) {
    console.error('[OMI-SEED] ❌ Errore:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedOmiData();
