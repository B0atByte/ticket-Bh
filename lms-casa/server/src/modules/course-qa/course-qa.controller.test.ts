import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  listQuestions: vi.fn(),
  getQuestion: vi.fn(),
  createQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  createAnswer: vi.fn(),
  acceptAnswer: vi.fn(),
  deleteAnswer: vi.fn(),
}));

vi.mock('./course-qa.service.js', () => svc);

import * as ctrl from './course-qa.controller.js';
import { HttpError } from '../../utils/httpError.js';

function mockRes() {
  const json = vi.fn();
  const end = vi.fn();
  const status = vi.fn(() => ({ json, end }));
  return { json, end, status };
}

const reqAuth = { auth: { userId: '5', roles: ['EMPLOYEE'], perms: [] } };

describe('course-qa.controller', () => {
  beforeEach(() => {
    for (const m of Object.values(svc)) m.mockReset();
  });

  it('listQuestions', async () => {
    svc.listQuestions.mockResolvedValueOnce({ items: [] });
    const res = mockRes();
    await ctrl.listQuestions(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { courseId: '1' }, query: {} } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('getQuestion', async () => {
    svc.getQuestion.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.getQuestion({ params: { questionId: '1' } } as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });

  it('createQuestion requires auth', async () => {
    await expect(
      ctrl.createQuestion(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { params: { courseId: '1' }, body: { title: 't', body: 'b' } } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockRes() as any,
      ),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('createQuestion returns 201', async () => {
    svc.createQuestion.mockResolvedValueOnce({ id: 99n });
    const res = mockRes();
    await ctrl.createQuestion(
      {
        params: { courseId: '1' },
        body: { title: 't', body: 'b' },
        ...reqAuth,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('deleteQuestion returns 204', async () => {
    svc.deleteQuestion.mockResolvedValueOnce(undefined);
    const res = mockRes();
    await ctrl.deleteQuestion(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { questionId: '1' }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('createAnswer returns 201', async () => {
    svc.createAnswer.mockResolvedValueOnce({ id: 99n });
    const res = mockRes();
    await ctrl.createAnswer(
      {
        params: { questionId: '1' },
        body: { body: 'answer' },
        ...reqAuth,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('acceptAnswer', async () => {
    svc.acceptAnswer.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    await ctrl.acceptAnswer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { answerId: '1' }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('deleteAnswer returns 204', async () => {
    svc.deleteAnswer.mockResolvedValueOnce(undefined);
    const res = mockRes();
    await ctrl.deleteAnswer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { answerId: '1' }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
