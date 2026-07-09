import { Router } from 'express';
import * as controller from './users.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, SUSPENDED, INVITED, DISABLED] }
 *     responses:
 *       200: { description: OK }
 */
router.get('/', requirePermission('user.read'), asyncHandler(controller.list));
// Self-service: any authenticated user can view their own training record.
// Registered before '/:id/record' so "me" is not parsed as a numeric id.
router.get('/me/record', asyncHandler(controller.getMyRecord));
router.get('/:id/record', requirePermission('user.read'), asyncHandler(controller.getRecord));
router.get('/:id', requirePermission('user.read'), asyncHandler(controller.get));
router.post('/', requirePermission('user.create'), asyncHandler(controller.create));
router.patch('/:id', requirePermission('user.update'), asyncHandler(controller.update));
router.post(
  '/:id/password',
  requirePermission('user.update'),
  asyncHandler(controller.changePassword),
);
router.delete('/:id', requirePermission('user.delete'), asyncHandler(controller.remove));

export default router;
