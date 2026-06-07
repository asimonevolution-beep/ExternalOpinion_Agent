'use strict';
const crypto = require('crypto');

/**
 * EDV — External Data Validation utilities
 * Deterministic hashing + verdict validation for audit trail & idempotency.
 */

/**
 * Produce a deterministic SHA-256 hex hash of the input object.
 * Keys are sorted so identical payloads always yield the same hash.
 */
function hashInput(obj) {
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Validate that a verdict object has the required fields and sane values.
 * Returns { valid: boolean, errors: string[] }.
 */
function validateVerdict(verdict) {
  const errors = [];
  if (!verdict || typeof verdict !== 'object') {
    return { valid: false, errors: ['Verdict must be a non-null object'] };
  }
  if (typeof verdict.risk_score !== 'number' || verdict.risk_score < 0 || verdict.risk_score > 100) {
    errors.push('risk_score must be a number between 0 and 100');
  }
  if (!['CRITICAL', 'MODERATE', 'CONTROLLED'].includes(verdict.risk_class)) {
    errors.push('risk_class must be CRITICAL, MODERATE, or CONTROLLED');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Express middleware that validates req.body.verdict before proceeding.
 */
function verdictValidationMiddleware(req, res, next) {
  const { verdict } = req.body || {};
  if (!verdict) return next();
  const { valid, errors } = validateVerdict(verdict);
  if (!valid) {
    return res.status(400).json({ success: false, error: 'Invalid verdict', details: errors });
  }
  next();
}

module.exports = { hashInput, validateVerdict, verdictValidationMiddleware };

