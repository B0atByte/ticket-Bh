import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    issue: { create: mocks.create },
  },
}));

vi.mock('../../config/env.js', () => ({
  env: { DISCORD_WEBHOOK_URL: '' },
}));

import { env } from '../../config/env.js';
import { create } from './issues.service.js';

describe('issues.service', () => {
  beforeEach(() => {
    mocks.create.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates an issue tied to the reporter', async () => {
    const issue = {
      id: 1n,
      description: 'ปุ่มบันทึกกดไม่ได้',
      page: '/dashboard',
      createdAt: new Date(),
      reporter: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
    };
    mocks.create.mockResolvedValueOnce(issue);

    const result = await create(42n, { description: 'ปุ่มบันทึกกดไม่ได้', page: '/dashboard' });

    expect(mocks.create).toHaveBeenCalledWith({
      data: { reporterId: 42n, description: 'ปุ่มบันทึกกดไม่ได้', page: '/dashboard' },
      include: { reporter: { select: { firstName: true, lastName: true, email: true } } },
    });
    expect(result).toBe(issue);
  });

  it('defaults page to null when omitted', async () => {
    mocks.create.mockResolvedValueOnce({
      id: 2n,
      description: 'test issue',
      page: null,
      createdAt: new Date(),
      reporter: null,
    });

    await create(1n, { description: 'test issue' });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ page: null }) }),
    );
  });

  it('skips the Discord webhook when DISCORD_WEBHOOK_URL is unset', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    mocks.create.mockResolvedValueOnce({
      id: 3n,
      description: 'test issue',
      page: null,
      createdAt: new Date(),
      reporter: null,
    });

    await create(1n, { description: 'test issue' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to Discord when DISCORD_WEBHOOK_URL is set', async () => {
    (env as { DISCORD_WEBHOOK_URL: string }).DISCORD_WEBHOOK_URL = 'https://discord.example/webhook';
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
    mocks.create.mockResolvedValueOnce({
      id: 4n,
      description: 'test issue',
      page: '/courses',
      createdAt: new Date(),
      reporter: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
    });

    await create(1n, { description: 'test issue', page: '/courses' });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://discord.example/webhook',
      expect.objectContaining({ method: 'POST' }),
    );
    (env as { DISCORD_WEBHOOK_URL: string }).DISCORD_WEBHOOK_URL = '';
  });

  it('swallows webhook errors without throwing', async () => {
    (env as { DISCORD_WEBHOOK_URL: string }).DISCORD_WEBHOOK_URL = 'https://discord.example/webhook';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    mocks.create.mockResolvedValueOnce({
      id: 5n,
      description: 'test issue',
      page: null,
      createdAt: new Date(),
      reporter: null,
    });

    await expect(create(1n, { description: 'test issue' })).resolves.toBeDefined();
    (env as { DISCORD_WEBHOOK_URL: string }).DISCORD_WEBHOOK_URL = '';
  });
});
