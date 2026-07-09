import { Router } from 'express';
import * as controller from './course-modules.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';

// Nested router — modules under a course
const nested = Router({ mergeParams: true });
nested.use(requireAuth);
nested.get('/', requirePermission('lesson.read'), asyncHandler(controller.listByCourse));
nested.post('/', requirePermission('lesson.create'), asyncHandler(controller.create));
nested.post('/reorder', requirePermission('lesson.update'), asyncHandler(controller.reorder));

// Flat router — operate on module by id
const flat = Router();
flat.use(requireAuth);
flat.patch('/:id', requirePermission('lesson.update'), asyncHandler(controller.update));
flat.delete('/:id', requirePermission('lesson.delete'), asyncHandler(controller.remove));

export { nested as moduleNestedRouter, flat as moduleFlatRouter };
