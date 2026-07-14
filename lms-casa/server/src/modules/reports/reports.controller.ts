import fs from 'node:fs';
import type { Request, Response } from 'express';
import { reportFilePath } from '../../jobs/processors/report.processor.js';
import { getReportQueue } from '../../jobs/queue.js';
import { audit } from '../../utils/audit.js';
import { HttpError } from '../../utils/httpError.js';
import { GenerateReportSchema } from './reports.schema.js';

export async function generate(req: Request, res: Response): Promise<void> {
  const input = GenerateReportSchema.parse(req.body);

  const job = await getReportQueue().add('generate', {
    kind: input.kind,
    examId: input.examId?.toString(),
    from: input.from?.toISOString(),
    to: input.to?.toISOString(),
  });

  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'report.generate',
    entityType: 'report',
    entityId: job.id,
    req,
    metadata: {
      kind: input.kind,
      examId: input.examId?.toString(),
      from: input.from?.toISOString(),
      to: input.to?.toISOString(),
    },
  });

  res.status(202).json({ jobId: job.id });
}

export async function status(req: Request, res: Response): Promise<void> {
  const jobId = String(req.params.jobId);
  const job = await getReportQueue().getJob(jobId);
  if (!job) throw HttpError.notFound('Report job not found');

  const state = await job.getState();
  res.json({
    jobId: job.id,
    state,
    failedReason: state === 'failed' ? job.failedReason : undefined,
  });
}

export async function download(req: Request, res: Response): Promise<void> {
  const jobId = String(req.params.jobId);
  const job = await getReportQueue().getJob(jobId);
  if (!job) throw HttpError.notFound('Report job not found');

  const state = await job.getState();
  if (state !== 'completed') {
    throw HttpError.badRequest(`Report is not ready yet (status: ${state})`);
  }

  const filePath = reportFilePath(job.id!);
  if (!fs.existsSync(filePath)) throw HttpError.notFound('Report file not found');

  res.download(filePath, `report-${job.id}.xlsx`);

  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'report.download',
    entityType: 'report',
    entityId: job.id,
    req,
  });
}
