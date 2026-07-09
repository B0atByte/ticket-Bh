import { Router } from 'express';
import * as controller from './departments.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /departments:
 *   get:
 *     tags: [Departments]
 *     summary: List departments (with active user counts)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
// Read is allowed for anyone who manages users (needed by the user form dropdown).
router.get('/', requirePermission('user.read'), asyncHandler(controller.list));

// Create / edit / delete are reserved for IT/admin (department.manage).
router.post('/', requirePermission('department.manage'), asyncHandler(controller.create));
router.patch('/:id', requirePermission('department.manage'), asyncHandler(controller.update));
router.delete('/:id', requirePermission('department.manage'), asyncHandler(controller.remove));

export default router;
