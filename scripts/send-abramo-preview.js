'use strict';
require('dotenv').config();
const fs = require('fs');
const { Resend } = require('resend');

const PDF_PATH = 'reports/ABRAMO_CASE_DIAGNOSTIC_PREVIEW.pdf';
const TO       = 'a.simonevolution@gmail.com';

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY non trovata in .env');
    process.exit(1);
  }

  const pdf = fs.readFileSync(PDF_PATH);
  const resend = new Resend(process.env.RESEND_API_KEY);

  console.log(`Invio a ${TO}...`);

  const { data, error } = await resend.emails.send({
    from:    'onboarding@resend.dev',
    to:      [TO],
    subject: 'External Opinion — Diagnostic Preview: Casa rurale Via Albareto, Bastiglia (MO)',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1612">
        <div style="background:#1A1612;padding:24px 32px;border-radius:8px 8px 0 0">
          <p style="color:#C8A96E;font-size:11px;letter-spacing:2px;margin:0 0 4px">EXTERNAL OPINION</p>
          <h1 style="color:#fff;font-size:22px;margin:0">Diagnostic Preview</h1>
          <p style="color:#C8A96E;font-size:12px;margin:4px 0 0">Parere tecnico indipendente</p>
        </div>
        <div style="background:#F5F0E8;padding:24px 32px">
          <p style="margin:0 0 16px"><strong>Casa rurale — Via Albareto s.n.c</strong><br>
          Bastiglia / Sorbara-Castelfranco (MO) &nbsp;|&nbsp; EK-105699065</p>

          <div style="background:#FEFCE8;border-left:4px solid #B8860B;padding:12px 16px;margin-bottom:16px;border-radius:0 4px 4px 0">
            <p style="color:#B8860B;font-weight:bold;margin:0 0 4px">🟡 GIALLO — Attenzione</p>
            <p style="margin:0;font-size:13px">NEGOZIARE / VERIFICARE DOCUMENTI PRIMA DI PROCEDERE</p>
          </div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr>
              <td style="background:#fff;padding:10px;text-align:center;border:1px solid #ddd">
                <div style="font-size:20px;font-weight:bold">75/100</div>
                <div style="font-size:10px;color:#8C8279">Risk Score</div>
              </td>
              <td style="background:#F5F0E8;padding:10px;text-align:center;border:1px solid #ddd">
                <div style="font-size:20px;font-weight:bold">€299/m²</div>
                <div style="font-size:10px;color:#8C8279">vs OMI €450</div>
              </td>
              <td style="background:#fff;padding:10px;text-align:center;border:1px solid #ddd">
                <div style="font-size:20px;font-weight:bold">50/100</div>
                <div style="font-size:10px;color:#8C8279">Coherence</div>
              </td>
              <td style="background:#F5F0E8;padding:10px;text-align:center;border:1px solid #ddd">
                <div style="font-size:20px;font-weight:bold;color:#C0392B">-32,3%</div>
                <div style="font-size:10px;color:#8C8279">ROI 5 anni</div>
              </td>
            </tr>
          </table>

          <p style="font-size:13px;margin:0 0 8px">Il documento completo è in allegato (PDF).</p>
          <p style="font-size:12px;color:#8C8279;margin:0">
            Questo documento è una preview diagnostica automatica — non sostituisce una perizia ufficiale.
          </p>
        </div>
        <div style="background:#1A1612;padding:12px 32px;border-radius:0 0 8px 8px;text-align:center">
          <p style="color:#C8A96E;font-size:11px;margin:0">
            Geom. Simone Azzali &nbsp;|&nbsp; info@externalopinion.it &nbsp;|&nbsp; externalopinion.it
          </p>
        </div>
      </div>`,
    attachments: [{
      filename:    'ExternalOpinion_DiagnosticPreview_Abramo.pdf',
      content:     pdf.toString('base64'),
      contentType: 'application/pdf',
    }],
  });

  if (error) {
    console.error('Errore Resend:', JSON.stringify(error, null, 2));
    process.exit(1);
  }

  console.log('Email inviata. ID:', data.id);
  console.log('A:', TO);
}

main().catch(e => { console.error(e.message); process.exit(1); });
