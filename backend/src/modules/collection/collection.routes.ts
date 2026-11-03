import { Router } from 'express';
import { CollectionController } from './collection.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireAnyBranchPermission } from '../../middleware/branchPermission.middleware.js';
import { validateRequest } from '../../middleware/validateRequest.middleware.js';
import {
  createCollectionSchema,
  collectionQuerySchema,
  collectionParamSchema,
} from './collection.schema.js';

export const collectionRoutes = Router();

collectionRoutes.post(
  '/',
  authenticate,
  requireAnyBranchPermission(['collections', 'pos']),
  validateRequest(createCollectionSchema),
  CollectionController.createCollection
);

collectionRoutes.get(
  '/',
  authenticate,
  requireAnyBranchPermission(['collections', 'pos']),
  validateRequest(collectionQuerySchema),
  CollectionController.getCollections
);

collectionRoutes.get(
  '/outstanding',
  authenticate,
  requireAnyBranchPermission(['collections', 'pos']),
  CollectionController.getOutstanding
);

collectionRoutes.get(
  '/overdue',
  authenticate,
  requireAnyBranchPermission(['collections', 'pos']),
  CollectionController.getOverdue
);

collectionRoutes.get(
  '/:id',
  authenticate,
  requireAnyBranchPermission(['collections', 'pos']),
  validateRequest(collectionParamSchema),
  CollectionController.getCollectionById
);

collectionRoutes.get(
  '/:id/receipt',
  authenticate,
  requireAnyBranchPermission(['collections', 'pos']),
  validateRequest(collectionParamSchema),
  CollectionController.getCollectionReceipt
);

