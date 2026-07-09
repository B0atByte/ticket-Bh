import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './audit-logs.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', requirePermission('audit.read'), asyncHandler(controller.list));
router.get(
  '/export.xlsx',
  requirePermission('audit.read', 'report.export'),
  asyncHandler(controller.exportXlsx),
);

export default router;
