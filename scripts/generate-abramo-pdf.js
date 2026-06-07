'use strict';
const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');
const { calculateDecisionSignal } = require('../src/engines/decision-signal');

// Dati caso Abramo — derivati dal motore (hardcoded per demo, da collegare a worker-scoring in Azione 3)
const ABRAMO = {
  riskScore:         75,
  coherenceIndex:    50,
  roi:               -32.3,
  documentsVerified: false,
};
const SIGNAL = calculateDecisionSignal(ABRAMO);

const FONT_DIR  = 'C:\\Windows\\Fonts';
const FONT_REG  = path.join(FONT_DIR, 'arial.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'arialbd.ttf');

const doc = new PDFDocument({ margin: 50, size: 'A4', info: {
  Title: 'External Opinion — Diagnostic Preview',
  Author: 'Geom. Simone Azzali',
  Subject: 'Casa rurale Via Albareto s.n.c, Bastiglia (MO)',
}});

doc.registerFont('Regular', FONT_REG);
doc.registerFont('Bold',    FONT_BOLD);

const out = fs.createWriteStream('reports/ABRAMO_CASE_DIAGNOSTIC_PREVIEW.pdf');
doc.pipe(out);

const W  = doc.page.width;
const L  = 50;
const R  = W - 50;
const CW = R - L;

const INK    = '#1A1612';
const ACCENT = '#C8A96E';
const GRAY   = '#8C8279';
const CREAM  = '#F5F0E8';
const RED    = '#C0392B';
const YELLOW = '#B8860B';
const YBG    = '#FEFCE8';
const GREEN  = '#1E8449';

const SIGNAL_COLOR_MAP = { GREEN: GREEN, YELLOW: YELLOW, RED: RED };
const SIGNAL_BG_MAP    = { GREEN: '#F0FBF4', YELLOW: YBG, RED: '#FDF3F3' };
const semaforoHex = SIGNAL_COLOR_MAP[SIGNAL.color] || YELLOW;
const semaforoBG  = SIGNAL_BG_MAP[SIGNAL.color]    || YBG;
const semaforoIT  = SIGNAL.color === 'GREEN' ? 'VERDE' : SIGNAL.color === 'RED' ? 'ROSSO' : 'GIALLO';

// ─── Header band ────────────────────────────────────────────────────────────
doc.rect(0, 0, W, 82).fill(INK);
doc.fillColor('#FFFFFF').fontSize(7.5).font('Regular')
   .text('E X T E R N A L   O P I N I O N', L, 20);
doc.fontSize(20).font('Bold')
   .text('Diagnostic Preview', L, 34);
doc.fontSize(8).font('Regular').fillColor(ACCENT)
   .text('Parere tecnico indipendente  |  Non è una perizia ufficiale', L, 62);

// ─── Property title ──────────────────────────────────────────────────────────
doc.fillColor(INK);
doc.y = 96;
doc.fontSize(13).font('Bold')
   .text('Casa rurale  —  Via Albareto s.n.c', L);
doc.fontSize(9.5).font('Regular').fillColor(GRAY)
   .text('Bastiglia / Sorbara-Castelfranco (MO)   |   EK-105699065   |   STUDIO E.P. IMMOBILIARE', L);
doc.fontSize(7.5).text('Dati elaborati: 07/06/2026', L);

// ─── Semaforo banner ─────────────────────────────────────────────────────────
const bY = doc.y + 8;
doc.rect(L, bY, CW, 52).fill(semaforoBG);
doc.rect(L, bY, 4,  52).fill(semaforoHex);
doc.fontSize(11).font('Bold').fillColor(semaforoHex)
   .text(`${semaforoIT} — ${SIGNAL.label}`, L + 12, bY + 7);
doc.fontSize(8).font('Regular').fillColor(INK)
   .text(SIGNAL.reason, L + 12, bY + 26, { width: CW - 20 });
doc.fontSize(7.5).font('Regular').fillColor(GRAY)
   .text(`Livello rischio: ${SIGNAL.riskLevel}`, L + 12, bY + 40);

// ─── KPI row ─────────────────────────────────────────────────────────────────
const kpis = [
  { label: 'Risk Score',  value: '75 / 100', sub: 'elevato'     },
  { label: 'Prezzo / m²', value: '€299',     sub: 'OMI €450'    },
  { label: 'Coherence',   value: '50 / 100', sub: 'medio-basso' },
  { label: 'ROI 5 anni',  value: '-32,3%',   sub: 'negativo',   red: true },
];
const kY = bY + 62;
const kW = CW / 4;
kpis.forEach((k, i) => {
  const x = L + i * kW;
  doc.rect(x, kY, kW, 48).fill(i % 2 === 0 ? CREAM : '#FFFFFF');
  doc.fontSize(18).font('Bold')
     .fillColor(k.red ? RED : INK)
     .text(k.value, x, kY + 5, { width: kW, align: 'center' });
  doc.fontSize(6.5).font('Regular').fillColor(GRAY)
     .text(k.label, x, kY + 29, { width: kW, align: 'center' });
  doc.fontSize(6.5).fillColor(GRAY)
     .text(k.sub,   x, kY + 38, { width: kW, align: 'center' });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sectionTitle(title) {
  const y = doc.y + 10;
  doc.fontSize(8).font('Bold').fillColor(ACCENT)
     .text(title, L, y, { characterSpacing: 0.8 });
  const lineY = doc.y;
  doc.moveTo(L, lineY).lineTo(R, lineY)
     .strokeColor(ACCENT).lineWidth(0.5).stroke();
  doc.y = lineY + 5;
  doc.fillColor(INK);
}

function tRow(label, value, shade) {
  const y = doc.y;
  if (shade) doc.rect(L, y - 1, CW, 14).fill(CREAM);
  doc.fontSize(7.5).font('Bold').fillColor(INK)
     .text(label, L + 4, y, { width: 165 });
  doc.fontSize(7.5).font('Regular').fillColor(INK)
     .text(value, L + 172, y, { width: CW - 175 });
  doc.y = y + 14;
}

// ─── Dati immobile ────────────────────────────────────────────────────────────
doc.y = kY + 58;
sectionTitle('DATI IMMOBILE');
tRow('Tipologia',        'Casa rurale',                                          false);
tRow('Indirizzo',        'Via Albareto s.n.c, Bastiglia / Sorbara-CF (MO)',      true);
tRow('Superficie',       '401 m²',                                               false);
tRow('Locali',           '6',                                                    true);
tRow('Prezzo richiesto', '€120.000',                                             false);
tRow('Prezzo / m²',      '€299/m²   (OMI €450/m²  –  scarto –33,5%)',           true);

// ─── Elementi di incertezza ───────────────────────────────────────────────────
sectionTitle('ELEMENTI DI INCERTEZZA DAI DATI DISPONIBILI');
const alerts = [
  ['Scarto prezzo / OMI', '€299/m² vs riferimento OMI €450/m² (–33,5%). La causa dello scarto non è determinabile senza documenti ufficiali.'],
  ['Superficie e stato', '401 m² in zona rurale: entità e costo degli interventi necessari non quantificabili senza sopralluogo e atti.'],
  ['Conformità urbanistica', 'Edificio pre-2000 in area rurale: possibili difformità rispetto al titolo edilizio originario. Non verificabile senza atti comunali.'],
  ['Accesso e pertinenze', 'Indirizzo s.n.c.: regime giuridico della strada, servitù e confini del lotto non definibili senza visura e mappa catastale.'],
];
alerts.forEach(([t, d]) => {
  const y = doc.y;
  doc.fontSize(7.5).font('Bold').fillColor(INK)
     .text(t + ':  ', L + 4, y, { continued: true, width: CW - 8 });
  doc.fontSize(7.5).font('Regular').fillColor(GRAY)
     .text(d, { width: CW - 8 });
  doc.y += 2;
});

// ─── Voci di costo non verificate ────────────────────────────────────────────
sectionTitle('VOCI DI COSTO NON VERIFICATE (STIME INDICATIVE)');
tRow('Intervento strutturale / impianti',  '€80.000 – €120.000  (stima: da verificare con sopralluogo)', false);
tRow('Eventuale sanatoria urbanistica',    '€15.000 – €40.000   (condizionato a verifica atti)',         true);
tRow('Aggiornamento catastale',            ' €3.000 –   €8.000  (se difformità planimetriche)',          false);
tRow('Oneri notarili e imposte acquisto',  ' €8.000 –  €12.000  (stima standard)',                       true);
doc.y += 3;
doc.fontSize(7.5).font('Regular').fillColor(GRAY)
   .text('Stima di investimento complessivo: €226.000 – €300.000 — Non verificabile senza atti ufficiali. Valore OMI potenziale: €180.450.', L + 4);

// ─── Flag documentali ─────────────────────────────────────────────────────────
sectionTitle('FLAG DI INCERTEZZA DOCUMENTALE');
const flags = [
  'Visura catastale',       'Conformità urbanistica',
  'Agibilità',              'APE (Attestato Prestazione Energetica)',
  'Condizione strutturale', 'Stato copertura / tetto',
  'Impianti',               'Accesso e servitù',
  'Confini del lotto',      'Vincoli paesaggistici / idrogeologici',
  'Destinazione d\'uso',    '',
];
const fColW = CW / 2;
for (let i = 0; i < flags.length; i += 2) {
  const y = doc.y;
  if (flags[i]) {
    doc.fontSize(7.5).font('Regular').fillColor(RED)
       .text('[ ]', L + 4, y, { continued: true });
    doc.fillColor(INK).text('  ' + flags[i], { width: fColW - 10 });
  }
  if (flags[i + 1]) {
    doc.fontSize(7.5).font('Regular').fillColor(RED)
       .text('[ ]', L + fColW, y, { continued: true });
    doc.fillColor(INK).text('  ' + flags[i + 1], { width: fColW - 10 });
  }
  doc.y = y + 12;
}

// ─── Documenti necessari per analisi completa ─────────────────────────────────
sectionTitle('DOCUMENTAZIONE NECESSARIA PER COMPLETARE L\'ANALISI');
const dY = doc.y;
doc.rect(L, dY, CW, 82).strokeColor(YELLOW).lineWidth(1).stroke()
   .rect(L, dY, CW, 82).fill(YBG);
doc.fontSize(8.5).font('Bold').fillColor(INK)
   .text('Senza i seguenti documenti l\'analisi tecnica rimane incompleta:', L + 10, dY + 8);
const steps = [
  '1. Visura catastale aggiornata — intestazione, planimetria, rendita, categoria',
  '2. Titoli edilizi e storia urbanistica — concessioni, varianti, eventuali condoni',
  '3. Certificato di agibilità — verifica validità e destinazione d\'uso attuale',
  '4. APE (Attestato di Prestazione Energetica) — obbligatorio per rogito',
  '5. Rilievo e sopralluogo tecnico — stato reale struttura, impianti, confini',
];
doc.fontSize(7.5).font('Regular').fillColor(INK);
steps.forEach((s, i) => doc.text(s, L + 10, dY + 22 + i * 11, { width: CW - 20 }));
doc.y = dY + 90;

// ─── Footer ───────────────────────────────────────────────────────────────────
doc.fontSize(6.5).font('Regular').fillColor(GRAY)
   .text(
     'External Opinion è un servizio di diagnostica immobiliare indipendente. ' +
     'Questo documento è una preview automatica — non sostituisce una perizia ufficiale.',
     L, doc.y, { width: CW, align: 'center' }
   );
doc.fontSize(7).fillColor(ACCENT)
   .text('Geom. Simone Azzali  |  info@externalopinion.it  |  externalopinion.it',
     L, doc.y + 4, { width: CW, align: 'center' });

doc.end();
out.on('finish', () => {
  const size = fs.statSync('reports/ABRAMO_CASE_DIAGNOSTIC_PREVIEW.pdf').size;
  console.log(`PDF OK — ${Math.round(size / 1024)} KB`);
  console.log('File: reports/ABRAMO_CASE_DIAGNOSTIC_PREVIEW.pdf');
});
out.on('error', e => { console.error('ERROR', e.message); process.exit(1); });
