import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  if (env.SMTP_HOST && env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  } else {
    // Dev fallback — JSON transport just logs the message
    transporter = nodemailer.createTransport({ jsonTransport: true });
    logger.warn(
      'SMTP not configured — using JSON transport (emails will only be logged, not delivered)',
    );
  }
  return transporter;
}

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(p: MailPayload): Promise<void> {
  const t = getTransporter();
  const info = await t.sendMail({
    from: env.MAIL_FROM,
    to: p.to,
    subject: p.subject,
    html: p.html,
    text: p.text ?? p.html.replace(/<[^>]*>/g, ''),
  });
  if ((info as { message?: string }).message) {
    logger.info(`[DEV mail] ${p.subject} → ${p.to}`);
  } else {
    logger.info(`Mail sent: ${p.subject} → ${p.to} (${info.messageId})`);
  }
}
