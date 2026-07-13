'use strict';
const crypto = require('crypto');

const VALID_VERDICTS = ['VERDE', 'GIALLO', 'ROSSO'];

/**
 * Crea un hash SHA-256 deterministico dell'input di analisi.
 * Usato per audit trail e idempotency check.
 */
function hashInput(payload) {
  const normalized = {
    urlAsta:    payload.urlAsta   || '',
    email:      payload.email     || '',
    service:    payload.service   || '',
    tier:       payload.tier      || '',
    zonaDati:   payload.zonaDati  || {},
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}

/**
 * Valida la struttura e i valori del verdict prodotto dalla pipeline.
 * Restituisce { valid: true } oppure { valid: false, errors: [...] }.
 */
function validateVerdict(verdict) {
  const errors = [];

  if (!verdict || typeof verdict !== 'object') {
    return { valid: false, errors: ['verdict mancante o non è un oggetto'] };
  }

  if (!VALID_VERDICTS.includes(verdict.colore)) {
    errors.push(`colore non valido: "${verdict.colore}" (atteso VERDE/GIALLO/ROSSO)`);
  }

  if (typeof verdict.coherenceIndex === 'number') {
    if (verdict.coherenceIndex < 0 || verdict.coherenceIndex > 1) {
      errors.push(`coherenceIndex fuori range: ${verdict.coherenceIndex} (atteso 0-1)`);
    }
  }

  if (verdict.roi !== undefined && typeof verdict.roi !== 'number') {
    errors.push(`roi non è un numero: ${verdict.roi}`);
  }

  if (typeof verdict.riskScore === 'number') {
    if (verdict.riskScore < 0 || verdict.riskScore > 100) {
      errors.push(`riskScore fuori range: ${verdict.riskScore} (atteso 0-100)`);
    }
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
}

/**
 * Middleware Express: valida il campo `verdict` nel body della richiesta.
 * Usato su endpoint che ricevono output della pipeline per garantire
 * che il verdict sia strutturalmente corretto prima dell'elaborazione.
 */
function verdictValidationMiddleware(req, res, next) {
  const verdict = req.body?.verdict || req.body;
  const result = validateVerdict(verdict);
  if (!result.valid) {
    return res.status(422).json({
      success: false,
      error: 'Verdict non valido',
      details: result.errors,
    });
  }
  next();
}

module.exports = { hashInput, validateVerdict, verdictValidationMiddleware };
