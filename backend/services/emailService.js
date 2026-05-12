require('dotenv').config();
const nodemailer = require('nodemailer');

const emailEnabled = process.env.EMAIL_ENABLED === 'true';

let transporter = null;
if (emailEnabled && process.env.EMAIL_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

async function sendNotification(subject, body) {
  const message = `[Zvelo Agent] ${subject}: ${body}`;
  console.log('📬', message);

  if (!emailEnabled || !transporter || !process.env.EMAIL_TO) return;

  try {
    await transporter.sendMail({
      from: `"Zvelo Agent" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `Zvelo Agent — ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f97316;">🚀 Zvelo Etsy Agent</h2>
          <p>${body}</p>
          <p><a href="http://localhost:5173" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Dashboard openen</a></p>
          <hr style="border: 1px solid #eee; margin: 20px 0;"/>
          <p style="color: #888; font-size: 12px;">Zvelo Etsy AI Agent — Lokale automatisering</p>
        </div>
      `
    });
    console.log(`[Email] Notificatie verstuurd naar ${process.env.EMAIL_TO}`);
  } catch (err) {
    console.error('[Email] Verzending mislukt:', err.message);
  }
}

module.exports = { sendNotification };
