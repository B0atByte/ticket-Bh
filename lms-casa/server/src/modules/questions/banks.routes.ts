import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './banks.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', requirePermission('question.read'), asyncHandler(controller.list));
router.post('/', requirePermission('question.create'), asyncHandler(controller.create));
router.patch('/:id', requirePermission('question.update'), asyncHandler(controller.update));
router.delete('/:id', requirePermission('question.delete'), asyncHandler(controller.remove));

export default router;
