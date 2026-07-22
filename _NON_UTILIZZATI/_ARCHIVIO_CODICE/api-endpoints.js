// api-endpoints.js (V19.1 API Gateway)
const express = require('express');
const router = express.Router(); // Usiamo Router per modularità
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs').promises; // Versione Async
const { createJob, analysisQueue } = require('./orchestrator'); // Integrazione Coda

// Percorsi
const CARICO_ASTE = path.join(__dirname, 'CARICO_ASTE');
const REPORT_FINALI = path.join(__dirname, 'REPORT_FINALI');

// Middleware per creare cartelle se non esistono (al primo avvio)
const ensureDirs = async () => {
  await fs.mkdir(CARICO_ASTE, { recursive: true }).catch(() => {});
  await fs.mkdir(REPORT_FINALI, { recursive: true }).catch(() => {});
};
ensureDirs();

// Endpoint 1: Diagnosi Asincrona (V19.1 Standard)
// Invece di elaborare ora, accettiamo il job e lo mettiamo in coda.
router.post(
  '/api/diagnosi',
  [
    body('titolo').notEmpty().trim().escape().withMessage('Titolo obbligatorio'),
    body('lotto').isNumeric().withMessage('Lotto deve essere numerico'),
    body('url').optional().isURL().withMessage('URL non valido'),
  ],
  async (req, res) => {
    // 1. Validazione Input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { titolo, lotto, url } = req.body;
    const jobId = `${titolo}-${lotto}-${Date.now()}`;

    try {
      // 2. Invio alla Coda BullMQ (Non-Blocking)
      // Questo delega il lavoro ai Worker, liberando l'API immediatamente.
      await analysisQueue.add('analysis', {
        jobId,
        titolo,
        lotto,
        url: url || null,
        createdAt: new Date().toISOString(),
      });

      // 3. Risposta Immediata al Client
      res.status(202).json({
        success: true,
        message: 'Diagnosi accettata e in elaborazione.',
        jobId: jobId,
        status: 'PENDING',
        checkStatusUrl: `/api/status/${jobId}`, // Endpoint fittizio per check futuro
      });

    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Endpoint 2: Health Check Semplice
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: 'V19.1-Gateway',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;