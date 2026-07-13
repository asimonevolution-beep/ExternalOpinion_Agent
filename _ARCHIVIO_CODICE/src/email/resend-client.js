const { Resend } = require('resend');
const fs = require('fs');

const FROM_DEFAULT = process.env.EMAIL_FROM || '"External Opinion" <noreply@externalopinion.it>';

async function sendEmailViaResend({ to, subject, html, attachments = [] }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY non configurata');

  const resend = new Resend(apiKey);

  const payload = { from: FROM_DEFAULT, to, subject, html };

  if (attachments.length > 0) {
    payload.attachments = attachments.map(a => ({
      filename: a.filename,
      content:  a.path ? fs.readFileSync(a.path) : Buffer.from(a.content || '', 'base64'),
    }));
  }

  const { data, error } = await resend.emails.send(payload);
  if (error) throw new Error(`Resend: ${error.message || JSON.stringify(error)}`);

  console.log(`[RESEND] Email inviata a ${to} — id: ${data.id}`);
  return { messageId: data.id, provider: 'resend' };
}

module.exports = { sendEmailViaResend };
