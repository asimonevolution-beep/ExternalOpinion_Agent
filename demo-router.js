'use strict';
const express = require('express');
const router = express.Router();

const NTFY_TOPIC = process.env.NTFY_TOPIC || 'externalopinion-demo';

async function ntfyNotify(title, body, tags = 'bell,house') {
  try {
    const res = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        Title: title,
        Tags: tags,
        Priority: 'high',
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body,
    });
    if (!res.ok) console.warn('[NTFY] HTTP', res.status);
  } catch (err) {
    console.error('[NTFY] Errore notifica:', err.message);
  }
}

// POST /api/demo/analyze-auction
// Riceve urlAsta, restituisce dati mock, invia notifica a Simone
router.post('/analyze-auction', async (req, res) => {
  const { urlAsta } = req.body || {};
  if (!urlAsta) {
    return res.status(400).json({ success: false, error: 'urlAsta obbligatorio' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '?';
  const ts = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

  // Notifica asincrona — non blocca la risposta
  ntfyNotify(
    'Nuovo lead demo — External Opinion',
    `Richiesta analisi demo\nURL: ${urlAsta}\nIP: ${ip}\nOra: ${ts}`,
    'bell,house,moneybag'
  );

  return res.json({
    success: true,
    mock: true,
    preview: {
      // Sezione libera
      coherenceIndex: 74,
      verdetto: 'GIALLO',
      prezzoBase: '€ 118.000',
      valutazioneCTU: '€ 148.500',
      scontoMercato: '-20,6%',
      superficie: '84 mq + 6 mq balcone',
      piano: '3° su 6',
      annoCostruzione: 1978,
      statoConservativo: 'Buono',
      occupazione: 'Libero al rilascio',
      speseArretrate: '€ 2.340',
      zonaOMI: 'B2 — €1.650/mq',
      rischi: [
        {
          livello: 'Medio',
          titolo: 'Veranda non dichiarata — Difformità urbanistica',
          desc: 'Vano veranda di ~4 mq realizzato senza DIA/SCIA. Sanabile ai sensi art. 37 D.P.R. 380/2001.',
          costo: '€ 7.800 – 9.200',
        },
        {
          livello: 'Basso',
          titolo: 'Spese condominiali insolute',
          desc: '€ 2.340 a carico dell\'acquirente per anno in corso + anno precedente (art. 63 disp. att. c.c.).',
          costo: 'Da scontare sull\'offerta massima',
        },
      ],
    },
  });
});

// POST /api/demo/checkout
// Usato dal pulsante "Sblocca" in demo.html
router.post('/checkout', async (req, res) => {
  if (process.env.STRIPE_SECRET_KEY) {
    // In produzione delega al flusso reale
    try {
      const { createCheckoutSession } = require('./stripe-webhook-handler');
      const session = await createCheckoutSession('DEMO', 'TIER_1_SCREENING_69', req.body.email);
      return res.json({ success: true, checkoutUrl: session.url });
    } catch (err) {
      console.error('[DEMO CHECKOUT]', err.message);
    }
  }
  // Fallback: placeholder per ambiente senza Stripe configurato
  return res.json({
    success: true,
    checkoutUrl: 'https://buy.stripe.com/test_demo',
  });
});

module.exports = router;
