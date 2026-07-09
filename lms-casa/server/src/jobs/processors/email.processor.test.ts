import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  processScheduled: vi.fn(),
}));

vi.mock('../email.js', () => ({ sendMail: mocks.sendMail }));
vi.mock('../queue.js', () => ({ processScheduledJob: mocks.processScheduled }));

import { processEmailJob } from './email.processor.js';

describe('processEmailJob', () => {
  beforeEach(() => {
    mocks.sendMail.mockReset();
    mocks.processScheduled.mockReset();
  });

  it('routes scheduled jobs to processScheduledJob', async () => {
    mocks.processScheduled.mockResolvedValueOnce(undefined);
    await processEmailJob({ type: 'cert-expiry' });
    expect(mocks.processScheduled).toHaveBeenCalledWith({ type: 'cert-expiry' });
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it('rejects email job missing required fields', async () => {
    await expect(processEmailJob({})).rejects.toThrow(/missing required fields/i);
  });

  it('sends email when all fields present', async () => {
    mocks.sendMail.mockResolvedValueOnce(undefined);
    await processEmailJob({ to: 'a@b.com', subject: 's', html: '<p>h</p>' });
    expect(mocks.sendMail).toHaveBeenCalledWith({
      to: 'a@b.com',
      subject: 's',
      html: '<p>h</p>',
    });
  });
});
