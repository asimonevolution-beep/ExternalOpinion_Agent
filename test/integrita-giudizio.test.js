// Verifiche di integrità del giudizio: allegati letti, nessun valore inventato.
// Esecuzione: node test/integrita-giudizio.test.js
// Harness: carica i worker con dipendenze esterne (BullMQ, Redis, DB) sostituite da stub.
const path = require('path');
const Module = require('module');
const assert = require('assert');
const REPO = path.resolve(__dirname, '..');
const origLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'bullmq') return { Worker: class { constructor(){ } on(){} } };
  if (req.endsWith('/db')) return {};
  if (req.endsWith('/orchestrator')) return { recordJobEvent: async()=>{}, safeRoiCalculation: (m,c)=> (m/c)*100, validateConfidenceThreshold: ()=>{} };
  if (req.endsWith('/redis-connection')) return { getSharedRedis: ()=>({}) };
  return origLoad.apply(this, arguments);
};
const cheerio = require(path.join(REPO,'node_modules/cheerio'));
const scraper = require(path.join(REPO,'src/workers/worker-scraper.js'));
const scoring = require(path.join(REPO,'src/workers/worker-scoring.js'));
const { z } = require(path.join(REPO,'node_modules/zod'));

let ok=0; const t=(n,f)=>{ f(); ok++; console.log('PASS', n); };

// 1. Link reali della pagina IVG Modena (letti dal browser il 04/11/2026)
const html = `<body>
<a href="https://library.astagiudiziaria.com/pdf/857e0c419af2504dd0dd7f231f2ef30d.pdf">Avviso di vendita</a>
<a href="https://library.astagiudiziaria.com/pdf/6d9329db0f640520a0e731894e54ef6c.pdf">Ordinanza di vendita</a>
<a href="https://library.astagiudiziaria.com/pdf/81f989c34e508f32fa8d093e99c242dd.pdf">Perizia</a>
<a href="https://library.astagiudiziaria.com/pdf/1f68ac737307820c1cdce8a2d46e4aa6.pdf">Planimetria</a>
<a href="https://library.astagiudiziaria.com/pdf/81f989c34e508f32fa8d093e99c242dd.pdf">Perizia</a>
<a href="https://library.astagiudiziaria.com/pdf/dbb8f9c7557e0ff6e937e9bc04350e4c.pdf" title="MO22824_1-03- Allegato A Perizia 228_2024">MO22824_1-03- Allegato A Perizia 228_2024</a>
<a href="https://pst.giustizia.it/PST/resources/cms/documents/ManualeUtenteOfferta06_08_2021.pdf">Download manuale deposito offerta PVP</a>
<a href="https://library.astagiudiziaria.com/pdf/PawPeMk2XUyf1WsJtlNN6IukHPHsbaK2NutrBt2o.pdf">Modulo per autodichiarazione di presa visione della perizia e stato civile</a>
<a href="https://library.astagiudiziaria.com/pdf/d256fd9f2a43596cc1cd82f8bcd64a3f.pdf">Trattamento dati personali</a>
</body>`;
t('allegati IVG: perizia prima, esclusi moduli/manuale/privacy, niente doppioni', () => {
  const a = scraper.trovaAllegatiPdf(cheerio.load(html), 'https://www.ivgmodena.it/inserzioni/x');
  assert.deepStrictEqual(a.map(x=>x.tipo), ['PERIZIA','ALLEGATO_PERIZIA','AVVISO','ORDINANZA']);
  assert.strictEqual(a[0].url, 'https://library.astagiudiziaria.com/pdf/81f989c34e508f32fa8d093e99c242dd.pdf');
});
// 2. Link reali astegiudiziarie.it (percorso /allegato/ senza estensione finale)
t('allegati astegiudiziarie.it', () => {
  const h = `<a href="/allegato/perizia-rm-ei-726-2025-c-1.pdf/2332149">Perizia</a><a href="/allegato/avviso-rm-ei-726-2025-dv20261125-1.pdf/2332149">Avviso</a><a href="/Allegato/Planimetria-RM-EI-726-2025-1.jpg/2332149">Planimetria</a>`;
  const a = scraper.trovaAllegatiPdf(cheerio.load(h), 'https://www.astegiudiziarie.it/vendita-asta-x');
  assert.strictEqual(a[0].tipo, 'PERIZIA');
  assert.strictEqual(a[0].url, 'https://www.astegiudiziarie.it/allegato/perizia-rm-ei-726-2025-c-1.pdf/2332149');
});

// 3. Caso reale di stasera: nessuna perizia letta, confidence 0.35 → giudizio non possibile, nessun numero inventato
const datiStasera = { costiSanatoria:0, costiRipristino:0, statoImmobile:'STATO_BUONO', difformita:{strutturale:false,urbanistica:false,catastale:false}, confidence:0.35, prezzoBase:6000, offertaMinima:4500, valoreStima:null, superficieMq:9.5 };
t('senza perizia: giudizio non possibile', () => {
  const p = scoring.valutaPresupposti(datiStasera, { periziaLetta:false }, 0.30);
  assert.strictEqual(p.giudizioPossibile, false);
  const e = scoring.esitoGiudizioNonPossibile(p.motivi, scoring.determinaValoreRiferimento(datiStasera, { valoreOMI: 2100 }));
  assert.strictEqual(e.coherenceIndex, null);
  assert.strictEqual(e.valoreAttuale, null);
  assert.strictEqual(e.valoreRiferimento, 6000);
  assert.match(e.decisionSignal.label, /GIUDIZIO NON POSSIBILE/);
});
// 4. Il segnaposto 2100 non viene mai usato come valore
t('segnaposto 2100 ignorato', () => {
  const r = scoring.determinaValoreRiferimento({ prezzoBase:null, valoreStima:null }, { valoreOMI: 2100 });
  assert.strictEqual(r.valore, null);
});
t('priorità valore: stima perizia > prezzo base', () => {
  assert.deepStrictEqual(scoring.determinaValoreRiferimento({ valoreStima: 8000, prezzoBase: 6000 }, {}), { valore: 8000, fonte: 'VALORE_STIMA_PERIZIA' });
  assert.deepStrictEqual(scoring.determinaValoreRiferimento({ valoreStima: null, prezzoBase: 6000 }, {}), { valore: 6000, fonte: 'PREZZO_BASE_ASTA' });
});
// 5. Con perizia letta: valori dai documenti, nessun coefficiente aggiunto
t('con perizia: valore = prezzo base, ROI calcolato sui costi della perizia', () => {
  const d = { ...datiStasera, confidence: 0.85, costiSanatoria: 1000, costiRipristino: 0 };
  assert.strictEqual(scoring.valutaPresupposti(d, { periziaLetta:true }, 0.30).giudizioPossibile, true);
  const c = scoring.eseguiMotoreDeterministico(d, { valoreRiferimento: 6000, trendZona: 0.02, anniProiezione: 2 });
  assert.strictEqual(c.valoreAttuale, 6000);
  assert.strictEqual(c.margineReale, 5000);
  assert.strictEqual(c.coherenceIndex, 100);
  assert.strictEqual(c.roi, null); // senza valore di stima il ROI non si calcola
});
t('ROI sul prezzo di acquisto: stima 8000, base 6000, costi 1000 → 14,29%', () => {
  const d = { ...datiStasera, confidence: 0.85, costiSanatoria: 1000, valoreStima: 8000 };
  const c = scoring.eseguiMotoreDeterministico(d, { valoreRiferimento: 8000, trendZona: 0.02, anniProiezione: 2 });
  assert.strictEqual(c.roi, 14.29);
});
t('con perizia ma senza valore nei documenti: valori null, niente numeri inventati', () => {
  const c = scoring.eseguiMotoreDeterministico({ ...datiStasera, confidence: 0.9 }, { valoreRiferimento: null, trendZona: 0.02, anniProiezione: 2 });
  assert.strictEqual(c.valoreAttuale, null); assert.strictEqual(c.roi, null);
});
// 6. Schema estrazione: campi economici null se assenti
t('schema AI: prezzi assenti restano null', () => {
  const src = require('fs').readFileSync(path.join(REPO,'ai-fallback-handler.js'),'utf8');
  assert.match(src, /prezzoBase: z\.number\(\)\.nonnegative\(\)\.nullable\(\)\.catch\(null\)/);
  assert.match(src, /slice\(0, MAX_CHARS_MODELLO\)/);
  assert.doesNotMatch(src, /slice\(0, 8000\)/);
});
console.log(`\n${ok} test superati`);
process.exit(0);
