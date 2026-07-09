import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './notifications.controller.js';

const router = Router();

// SSE connections authenticate via the httpOnly access-token cookie
// (EventSource is opened with `withCredentials: true` on the client).
router.get(
  '/stream',
  requireAuth,
  requirePermission('course.read'),
  controller.stream,
);

router.use(requireAuth);
router.get('/', requirePermission('course.read'), asyncHandler(controller.listMine));
router.post('/self-test', requirePermission('course.read'), asyncHandler(controller.createSelfTest));
router.post('/', requirePermission('user.update'), asyncHandler(controller.create));
router.post('/read-all', requirePermission('course.read'), asyncHandler(controller.markAllRead));
router.post('/:id/read', requirePermission('course.read'), asyncHandler(controller.markRead));

export default router;
