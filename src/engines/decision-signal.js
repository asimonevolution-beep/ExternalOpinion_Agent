'use strict';

/**
 * EXTERNAL OPINION — Decision Signal Engine
 * Unica funzione di decisione VERDE / GIALLO / ROSSO per tutto il sistema.
 *
 * Regole:
 *   ROI < -20%        → mai GREEN
 *   coherenceIndex <60 → mai GREEN
 *   documentsVerified false → mai GREEN
 *   riskScore 0-35    → GREEN se tutto ok, altrimenti YELLOW
 *   riskScore 36-65   → YELLOW; RED se ROI fortemente negativo E coherence < 40
 *   riskScore 66-80   → YELLOW per negoziazione; RED se ROI < -20 E coherence < 40
 *   riskScore 81-100  → RED sempre
 */

const LABELS = {
  GREEN: {
    LOW:    'SCENARIO FAVOREVOLE — VERIFICA TECNICA STANDARD',
    MEDIUM: 'SCENARIO DA APPROFONDIRE — VERIFICA DOCUMENTI',
  },
  YELLOW: {
    MEDIUM: 'NEGOZIARE / VERIFICARE DOCUMENTI PRIMA DI PROCEDERE',
    HIGH:   'NEGOZIARE / VERIFICARE DOCUMENTI PRIMA DI PROCEDERE',
  },
  RED: {
    HIGH:     'SCENARIO CRITICO — REVISIONE RADICALE NECESSARIA',
    CRITICAL: 'SCENARIO CRITICO — REVISIONE RADICALE NECESSARIA',
  },
};

function calculateDecisionSignal({ riskScore, coherenceIndex, roi, documentsVerified = false }) {
  const rs = Number(riskScore)      || 0;
  const ci = Number(coherenceIndex) || 0;
  const r  = (roi !== null && roi !== undefined) ? Number(roi) : null;

  const roiNegativeStrong = r !== null && r < -20;
  const coherenceLow      = ci < 40;
  const coherenceWeak     = ci < 60;
  const roiPositive       = r !== null && r > 0;

  const cannotBeGreen = roiNegativeStrong || coherenceWeak || !documentsVerified;

  let color, riskLevel, reason, customerAction;

  if (rs <= 35) {
    if (!cannotBeGreen && roiPositive && ci >= 70) {
      color     = 'GREEN';
      riskLevel = 'LOW';
      reason    = 'Profilo di rischio contenuto, coerenza economica positiva e documentazione nella norma.';
      customerAction = 'Procedere con verifica tecnica standard prima del rogito.';
    } else {
      color     = 'YELLOW';
      riskLevel = 'MEDIUM';
      reason    = 'Rischio basso ma coerenza economica o documentazione insufficienti per giudizio definitivo.';
      customerAction = 'Acquisire documentazione tecnica e verificare la coerenza economica prima di procedere.';
    }
  } else if (rs <= 65) {
    if (roiNegativeStrong && coherenceLow) {
      color     = 'RED';
      riskLevel = 'CRITICAL';
      reason    = 'Coerenza economica molto bassa e ROI fortemente negativo. Operazione non sostenibile allo stato attuale.';
      customerAction = 'Sospendere la valutazione. Richiedere revisione radicale delle condizioni o scartare l\'immobile.';
    } else {
      color     = 'YELLOW';
      riskLevel = 'MEDIUM';
      reason    = 'Anomalie rilevate che richiedono verifica tecnica e documentale prima di qualsiasi decisione.';
      customerAction = 'Acquisire documentazione tecnica, stimare i costi reali e usare le criticità come leva negoziale prima di procedere.';
    }
  } else if (rs <= 80) {
    if (roiNegativeStrong && coherenceLow) {
      color     = 'RED';
      riskLevel = 'CRITICAL';
      reason    = 'Rischio elevato, coerenza molto bassa e ROI fortemente negativo. Operazione non sostenibile senza intervento radicale.';
      customerAction = 'Sospendere. Richiedere analisi completa prima di qualsiasi impegno contrattuale.';
    } else {
      color     = 'YELLOW';
      riskLevel = 'HIGH';
      reason    = 'Rischio rilevante con elementi di incertezza documentale. Coerenza economica da verificare con dati ufficiali.';
      customerAction = 'Acquisire documentazione tecnica, stimare i costi reali e usare le criticità come leva negoziale prima di procedere.';
    }
  } else {
    color     = 'RED';
    riskLevel = 'CRITICAL';
    reason    = 'Profilo di rischio critico. Elementi di criticità multipli che rendono l\'operazione non valutabile senza analisi approfondita.';
    customerAction = 'Sospendere la valutazione. Richiedere analisi completa firmata prima di qualsiasi impegno contrattuale.';
  }

  const label = LABELS[color]?.[riskLevel] || LABELS[color]?.['HIGH'] || LABELS[color]?.['CRITICAL'];

  return { color, label, riskLevel, reason, customerAction };
}

/**
 * Converte color EN → semaforo IT (usato internamente nei worker).
 * 'GREEN' → 'VERDE'  |  'YELLOW' → 'GIALLO'  |  'RED' → 'ROSSO'
 */
function colorToSemaforo(color) {
  return color === 'GREEN' ? 'VERDE' : color === 'RED' ? 'ROSSO' : 'GIALLO';
}

module.exports = { calculateDecisionSignal, colorToSemaforo };
