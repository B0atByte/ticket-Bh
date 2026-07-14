import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  getReportQueue: vi.fn(),
  reportFilePath: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('../../jobs/queue.js', () => ({ getReportQueue: mocks.getReportQueue }));
vi.mock('../../jobs/processors/report.processor.js', () => ({
  reportFilePath: mocks.reportFilePath,
}));
vi.mock('../../utils/audit.js', () => ({ audit: mocks.audit }));

import * as ctrl from './reports.controller.js';

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    download: vi.fn(),
  } as unknown as Response;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return { auth: { userId: '7', roles: [], perms: [] }, params: {}, body: {}, ...overrides } as unknown as Request;
}

describe('generate', () => {
  it('enqueues a report job and returns 202 with jobId', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'job-1' });
    mocks.getReportQueue.mockReturnValue({ add });
    const req = mockReq({ body: { kind: 'course-completion' } } as Partial<Request>);
    const res = mockRes();

    await ctrl.generate(req, res);

    expect(add).toHaveBeenCalledWith('generate', expect.objectContaining({ kind: 'course-completion' }));
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ jobId: 'job-1' });
    expect(mocks.audit).toHaveBeenCalled();
  });
});

describe('status', () => {
  it('throws not found when the job does not exist', async () => {
    mocks.getReportQueue.mockReturnValue({ getJob: vi.fn().mockResolvedValue(null) });
    const req = mockReq({ params: { jobId: 'missing' } } as Partial<Request>);
    await expect(ctrl.status(req, mockRes())).rejects.toThrow();
  });

  it('returns the job state', async () => {
    const job = { id: 'job-2', getState: vi.fn().mockResolvedValue('completed'), failedReason: undefined };
    mocks.getReportQueue.mockReturnValue({ getJob: vi.fn().mockResolvedValue(job) });
    const req = mockReq({ params: { jobId: 'job-2' } } as Partial<Request>);
    const res = mockRes();

    await ctrl.status(req, res);

    expect(res.json).toHaveBeenCalledWith({ jobId: 'job-2', state: 'completed', failedReason: undefined });
  });
});

describe('download', () => {
  it('rejects when the job is not completed yet', async () => {
    const job = { id: 'job-3', getState: vi.fn().mockResolvedValue('active') };
    mocks.getReportQueue.mockReturnValue({ getJob: vi.fn().mockResolvedValue(job) });
    const req = mockReq({ params: { jobId: 'job-3' } } as Partial<Request>);
    await expect(ctrl.download(req, mockRes())).rejects.toThrow();
  });

  it('rejects when the completed job has no file on disk', async () => {
    const job = { id: 'job-4', getState: vi.fn().mockResolvedValue('completed') };
    mocks.getReportQueue.mockReturnValue({ getJob: vi.fn().mockResolvedValue(job) });
    mocks.reportFilePath.mockReturnValue(path.join(os.tmpdir(), 'does-not-exist-report.xlsx'));
    const req = mockReq({ params: { jobId: 'job-4' } } as Partial<Request>);
    await expect(ctrl.download(req, mockRes())).rejects.toThrow();
  });

  it('streams the file when the job is completed', async () => {
    const job = { id: 'job-5', getState: vi.fn().mockResolvedValue('completed') };
    mocks.getReportQueue.mockReturnValue({ getJob: vi.fn().mockResolvedValue(job) });
    const filePath = path.join(os.tmpdir(), `report-test-${job.id}.xlsx`);
    fs.writeFileSync(filePath, 'fake xlsx content');
    mocks.reportFilePath.mockReturnValue(filePath);
    const req = mockReq({ params: { jobId: 'job-5' } } as Partial<Request>);
    const res = mockRes();

    try {
      await ctrl.download(req, res);
      expect(res.download).toHaveBeenCalledWith(filePath, 'report-job-5.xlsx');
      expect(mocks.audit).toHaveBeenCalled();
    } finally {
      fs.unlinkSync(filePath);
    }
  });
});
