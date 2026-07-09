import { Router } from 'express';
import * as controller from './attempts.controller.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const nested = Router({ mergeParams: true });
nested.use(requireAuth);
nested.post('/', requirePermission('exam.take'), asyncHandler(controller.start));

const flat = Router();
flat.use(requireAuth);
flat.get('/', requirePermission('exam.take'), asyncHandler(controller.listMine));
flat.get('/:id', requirePermission('exam.take'), asyncHandler(controller.get));
flat.post('/:id/responses', requirePermission('exam.take'), asyncHandler(controller.saveResponse));
flat.post('/:id/submit', requirePermission('exam.take'), asyncHandler(controller.submit));
// Phase 2: anti-cheat event logging
flat.post('/:id/events', requirePermission('exam.take'), asyncHandler(controller.logEvent));

export { nested as attemptsNestedRouter, flat as attemptsFlatRouter };
