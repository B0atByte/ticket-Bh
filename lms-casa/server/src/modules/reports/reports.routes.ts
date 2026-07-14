import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './reports.controller.js';

const router = Router();

router.use(requireAuth);
router.post('/', requirePermission('report.read', 'report.export'), asyncHandler(controller.generate));
router.get('/:jobId', requirePermission('report.read'), asyncHandler(controller.status));
router.get(
  '/:jobId/download',
  requirePermission('report.read', 'report.export'),
  asyncHandler(controller.download),
);

export default router;
