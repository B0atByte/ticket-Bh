import type { RequestHandler } from 'express';

type AsyncHandler = (
  ...args: Parameters<RequestHandler>
) => Promise<void | unknown>;

export const asyncHandler =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
