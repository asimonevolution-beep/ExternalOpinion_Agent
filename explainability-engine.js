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

function spiegaROI(roi, margineReale, investimento, roiConveniente) {
  const euro = (v) => (v === null || v === undefined ? 'non disponibile' : `€${Math.round(v).toLocaleString('it-IT')}`);
  const base = {
    profitMargin: margineReale ?? null,
    totalInvestment: investimento ?? null,
    breakdownExplanation: `Investimento (prezzo base + costi indicati): ${euro(investimento)}`,
    profitExplanation: `Margine sulla stima del perito: ${euro(margineReale)}`,
  };
  if (roi === null || roi === undefined) {
    return {
      roiPercentage: null,
      roiType: 'NON_CALCOLABILE',
      convenient: false,
      analysis: { ...base, roiExplanation: 'Margine non calcolabile: nei documenti mancano il valore di stima del perito o il prezzo base' },
      recommendation: 'Senza valore di stima e prezzo base il margine non si calcola: serve la perizia completa.',
    };
  }
  const roiType = roi > 25 ? 'ECCELLENTE' : roi > 18 ? 'BUONO' : roi >= 0 ? 'CONTENUTO' : 'NEGATIVO';
  return {
    roiPercentage: roi.toFixed(2),
    roiType,
    convenient: roiConveniente,
    analysis: { ...base, roiExplanation: `Margine al prezzo base: ${roi.toFixed(2)}%` },
    recommendation:
      roi > 18 ? 'Margine al prezzo base superiore al 18%.'
        : roi >= 0 ? 'Margine al prezzo base contenuto: la convenienza dipende dall\'offerta che presenti.'
          : 'Al prezzo base si paga più della stima del perito: conviene solo a un prezzo più basso.',
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
    riskFactors.push(calcoliScoring.roi !== null ? {
      categoria: 'Economico',
      severita: calcoliScoring.roi < 0 ? 'ALTA' : 'MEDIA',
      descrizione: 'Margine contenuto al prezzo base',
      impatto: `Margine ${calcoliScoring.roi.toFixed(2)}% al prezzo base${calcoliScoring.roiOffertaMinima != null ? `, ${calcoliScoring.roiOffertaMinima.toFixed(2)}% all'offerta minima` : ''}`,
    } : {
      categoria: 'Economico',
      severita: 'MEDIA',
      descrizione: 'Dati economici incompleti',
      impatto: 'Margine non calcolabile: manca il valore di stima o il prezzo base',
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

function generateRiskRecommendation(c) {
  const conforme = c.coherenceIndex > 70;
  if (c.roi === null || c.roi === undefined) {
    return conforme ? 'Documenti senza difformità rilevanti; margine non calcolabile per dati economici mancanti.'
      : 'Difformità da valutare e dati economici incompleti: serve una verifica tecnica prima di offrire.';
  }
  if (conforme && c.roiConveniente) return 'Documenti coerenti e margine positivo al prezzo base. Procedere con le verifiche standard.';
  if (conforme) return 'Documenti coerenti; il margine dipende dall\'offerta: fissare un prezzo massimo sotto la stima del perito.';
  if (c.coherenceIndex > 40) return 'Difformità da quantificare prima di offrire; tenerne conto nel prezzo.';
  return 'Difformità gravi: non procedere senza una verifica tecnica completa.';
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
      calcoliScoring.investimento ?? null,
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
