import type { RequestHandler } from 'express';
import { HttpError } from '../utils/httpError.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};
