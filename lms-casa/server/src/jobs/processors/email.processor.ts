import { sendMail } from '../email.js';
import type { SendEmailJob } from '../queue.js';
import { processScheduledJob } from '../queue.js';

export async function processEmailJob(data: SendEmailJob): Promise<void> {
  if (data.type) {
    await processScheduledJob({ type: data.type });
    return;
  }
  if (!data.to || !data.subject || !data.html) {
    throw new Error('Email job missing required fields (to/subject/html)');
  }
  await sendMail({ to: data.to, subject: data.subject, html: data.html });
}
