/**
 * EXTERNAL OPINION — EXPLAINABILITY ENGINE V18.2
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Fornisce spiegazioni interpretabili per ogni score generato.
 * Obiettivo: Trasformare "Coherence Index = 42" in motivazioni comprensibili.
 */

// ============================================================================
// COHERENCE INDEX EXPLANATIONS
// ============================================================================

function spiegaCoherenceIndex(coherenceIndex, difformita, statoImmobile) {
  const motivi = [];
  const penaltyBreakdown = [];

  // Penalità per difformità strutturale (-50%)
  if (difformita.strutturale) {
    penaltyBreakdown.push({
      tipo: 'strutturale',
      penalita: 50,
      descrizione: 'Abuso strutturale rilevato',
      impatto:
        'Rischio di ordine di demolizione, costi elevati di ripristino',
    });
    motivi.push('Abuso strutturale rilevato');
  }

  // Penalità per difformità urbanistica (-35%)
  if (difformita.urbanistica) {
    penaltyBreakdown.push({
      tipo: 'urbanistica',
      penalita: 35,
      descrizione: 'Non conformità urbanistica',
      impatto: 'Sanatoria complessa, costi procedurali elevati',
    });
    motivi.push('Non conformità urbanistica');
  }

  // Penalità per difformità catastale (-15%)
  if (difformita.catastale) {
    penaltyBreakdown.push({
      tipo: 'catastale',
      penalita: 15,
      descrizione: 'Incongruenza catastale',
      impatto: 'Rettifica catastale, oneri notarili',
    });
    motivi.push('Incongruenza catastale');
  }

  // Stato dell'immobile
  if (statoImmobile === 'STATO_CRITICO') {
    motivi.push('Stato dell\'immobile critico (elevato degrado)');
  } else if (statoImmobile === 'STATO_MEDIO') {
    motivi.push('Stato dell\'immobile degradato');
  }

  const totalPenalty = penaltyBreakdown.reduce(
    (sum, p) => sum + p.penalita,
    0
  );

  return {
    scoreValue: coherenceIndex,
    riskLevel:
      coherenceIndex > 70 ? 'BASSO' : coherenceIndex > 40 ? 'MEDIO' : 'ALTO',
    semaforo:
      coherenceIndex > 70 ? 'VERDE' : coherenceIndex > 40 ? 'GIALLO' : 'ROSSO',
    totalPenaltyPercentage: Math.min(100, totalPenalty),
    penaltyBreakdown,
    motivazioni: motivi,
    interpretazione: generateCoherenceInterpretation(coherenceIndex),
  };
}

function generateCoherenceInterpretation(coherenceIndex) {
  if (coherenceIndex > 85) {
    return 'Immobile conforme e in buone condizioni. Operazione a rischio contenuto.';
  } else if (coherenceIndex > 70) {
    return 'Conformità generale con lievi anomalie. Operazione supportata, con dovute cautele.';
  } else if (coherenceIndex > 55) {
    return 'Conformità parziale con anomalie significative. Operazione praticabile ma con rischi moderati.';
  } else if (coherenceIndex > 40) {
    return 'Anomalie importanti. Operazione complessa con rischi moderati. Consulenza tecnica consigliata.';
  } else if (coherenceIndex > 25) {
    return 'Anomalie critiche. Operazione ad alto rischio. Consulenza tecnica obbligatoria.';
  } else {
    return 'Immobile gravemente non conforme. Operazione sconsigliata. Costi di sanamento molto elevati.';
  }
}

// ============================================================================
// ROI EXPLANATIONS
// ============================================================================

function spiegaROI(roi, margineReale, costiTotali, roiConveniente) {
  const roiType = roi > 25 ? 'ECCELLENTE' : roi > 18 ? 'BUONO' : 'INSUFFICIENTE';

  return {
    roiPercentage: roi.toFixed(2),
    roiType,
    convenient: roiConveniente,
    analysis: {
      profitMargin: margineReale,
      totalInvestment: costiTotali,
      breakdownExplanation: `Investimento totale: €${costiTotali.toLocaleString()}`,
      profitExplanation: `Margine netto: €${margineReale.toLocaleString()}`,
      roiExplanation: `Ritorno sull'investimento: ${roi.toFixed(2)}%`,
    },
    recommendation:
      roi > 18
        ? `ROI superiore alla soglia minima (18%). Operazione potenzialmente conveniente.`
        : `ROI insufficiente (${roi.toFixed(2)}% vs soglia 18%). Operazione sconsigliata.`,
  };
}

// ============================================================================
// VALUATION EXPLANATIONS
// ============================================================================

function spiegaValutazione(
  valoreAttuale,
  valorePotenziale,
  valoreFuturo,
  statoImmobile,
  coeffDegrado
) {
  const spread = valorePotenziale - valoreAttuale;
  const spreadFuturo = valoreFuturo - valorePotenziale;
  const spreadTotale = valoreFuturo - valoreAttuale;

  return {
    valoriInEuro: {
      attuale: valoreAttuale,
      potenziale: valorePotenziale,
      futuro: valoreFuturo,
    },
    analisiSpread: {
      postSanatoriaGain: spread,
      futureGrowth: spreadFuturo,
      totalGain: spreadTotale,
    },
    stato: statoImmobile,
    coefficienteDegrado: coeffDegrado,
    interpretazione: {
      statoDescrizione: describeStatoImmobile(statoImmobile),
      potenzialeSanatoria: `Potenziale di rivalutazione: €${spread.toLocaleString()} (sanatoria & ristrutturazione)`,
      potenzialeFuturo: `Crescita di mercato stimata: €${spreadFuturo.toLocaleString()} (2 anni, trend ${(spreadFuturo / valorePotenziale * 100).toFixed(1)}%)`,
    },
  };
}

function describeStatoImmobile(stato) {
  const descriptions = {
    STATO_OTTIMO: 'Buone condizioni, minuti interventi',
    STATO_BUONO: 'Buone condizioni con lievi difetti',
    STATO_MEDIO: 'Condizioni mediocri, necessari lavori di manutenzione',
    STATO_CRITICO:
      'Condizioni critiche, ampi lavori di ripristino richiesti',
  };
  return descriptions[stato] || 'Stato sconosciuto';
}

// ============================================================================
// RISK PROFILE SUMMARY
// ============================================================================

function generaProfiloRischio(calcoliScoring, datiEstrazione) {
  const riskFactors = [];

  // Fattori di rischio strutturale
  if (datiEstrazione.difformita.strutturale) {
    riskFactors.push({
      categoria: 'Strutturale',
      severita: 'ALTA',
      descrizione: 'Abuso strutturale',
      impatto: 'Rischio demolizione, costi elevati',
    });
  }

  // Fattori di rischio amministrativo
  if (datiEstrazione.difformita.urbanistica) {
    riskFactors.push({
      categoria: 'Amministrativo',
      severita: 'MEDIA',
      descrizione: 'Non conformità urbanistica',
      impatto: 'Sanatoria complessa',
    });
  }

  if (datiEstrazione.difformita.catastale) {
    riskFactors.push({
      categoria: 'Catastale',
      severita: 'BASSA',
      descrizione: 'Incongruenza catastale',
      impatto: 'Rettifica catastale',
    });
  }

  // Fattori di rischio economico
  if (!calcoliScoring.roiConveniente) {
    riskFactors.push({
      categoria: 'Economico',
      severita: 'MEDIA',
      descrizione: 'ROI insufficiente',
      impatto: `ROI ${calcoliScoring.roi.toFixed(2)}% < 18% threshold`,
    });
  }

  return {
    overallRiskScore: calcoliScoring.coherenceIndex,
    riskLevel:
      calcoliScoring.coherenceIndex > 70
        ? 'BASSO'
        : calcoliScoring.coherenceIndex > 40
          ? 'MEDIO'
          : 'ALTO',
    riskFactors,
    numeroDifformita: Object.values(datiEstrazione.difformita).filter(
      (v) => v === true
    ).length,
    recommendation: generateRiskRecommendation(calcoliScoring),
  };
}

function generateRiskRecommendation(calcoliScoring) {
  if (calcoliScoring.coherenceIndex > 70 && calcoliScoring.roiConveniente) {
    return 'Operazione supportata. Rischi contenuti e ROI positivo. Procedere con consulenza tecnica standard.';
  } else if (calcoliScoring.coherenceIndex > 40 && calcoliScoring.roiConveniente) {
    return 'Operazione possibile ma con rischi moderati. Consultare geom. ed esperti di sanatoria.';
  } else if (calcoliScoring.coherenceIndex > 40) {
    return 'Operazione con rischi moderati e ROI insufficiente. Sconsigliata se non supportata da altri fattori.';
  } else {
    return 'Operazione ad alto rischio. Sconsigliata senza motivazioni molto forti. Contattare esperti di settore.';
  }
}

// ============================================================================
// FULL EXPLANATION REPORT
// ============================================================================

function generaRelazioneCompletaSpiegata(calcoliScoring, datiEstrazione) {
  return {
    coherence: spiegaCoherenceIndex(
      calcoliScoring.coherenceIndex,
      datiEstrazione.difformita,
      datiEstrazione.statoImmobile
    ),
    valuation: spiegaValutazione(
      calcoliScoring.valoreAttuale,
      calcoliScoring.valorePotenziale,
      calcoliScoring.valoreFuturoProiettato,
      datiEstrazione.statoImmobile,
      /* coeffDegrado */ 0.6
    ),
    roi: spiegaROI(
      calcoliScoring.roi,
      calcoliScoring.margineReale,
      calcoliScoring.roi > 0
        ? calcoliScoring.margineReale / (calcoliScoring.roi / 100)
        : 0,
      calcoliScoring.roiConveniente
    ),
    riskProfile: generaProfiloRischio(calcoliScoring, datiEstrazione),
    dataQuality: {
      confidenceScore: datiEstrazione.confidence,
      confidenceLevel:
        datiEstrazione.confidence > 0.9
          ? 'ALTA'
          : datiEstrazione.confidence > 0.7
            ? 'MEDIA'
            : 'BASSA',
      source: datiEstrazione.source,
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  spiegaCoherenceIndex,
  spiegaROI,
  spiegaValutazione,
  generaProfiloRischio,
  generaRelazioneCompletaSpiegata,
  describeStatoImmobile,
};
