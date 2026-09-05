import { Router } from 'express';
import {
  getVendorProducts,
  addVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
  getVendorOrders,
  acceptVendorOrder,
  rejectVendorOrder,
  getVendorBills,
  searchVendorSourcing,
  createVendorPurchaseRequest,
} from '../controllers/vendorPortalController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

// Sourcing search and purchase request creation by company team
router.get('/sourcing', requireAuth, searchVendorSourcing);
router.post('/request-order', requireAuth, createVendorPurchaseRequest);

// Vendor-specific routes
router.get(
  '/products',
  requireAuth,
  requireRole([Role.Vendor, Role.MasterAdmin, Role.Administrator]),
  getVendorProducts
);
router.post(
  '/products',
  requireAuth,
  requireRole([Role.Vendor, Role.MasterAdmin, Role.Administrator]),
  addVendorProduct
);
router.put(
  '/products/:id',
  requireAuth,
  requireRole([Role.Vendor, Role.MasterAdmin, Role.Administrator]),
  updateVendorProduct
);
router.delete(
  '/products/:id',
  requireAuth,
  requireRole([Role.Vendor, Role.MasterAdmin, Role.Administrator]),
  deleteVendorProduct
);

// Order management for vendors
router.get(
  '/orders',
  requireAuth,
  requireRole([Role.Vendor, Role.MasterAdmin, Role.Administrator]),
  getVendorOrders
);
router.post(
  '/orders/:id/accept',
  requireAuth,
  requireRole([Role.Vendor, Role.MasterAdmin, Role.Administrator]),
  acceptVendorOrder
);
router.post(
  '/orders/:id/reject',
  requireAuth,
  requireRole([Role.Vendor, Role.MasterAdmin, Role.Administrator]),
  rejectVendorOrder
);

// Vendor Bills
router.get(
  '/bills',
  requireAuth,
  requireRole([Role.Vendor, Role.MasterAdmin, Role.Administrator]),
  getVendorBills
);

export default router;
