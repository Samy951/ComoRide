import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { requireAdmin } from '../middleware/admin.middleware';

const router = Router();

// Auth endpoints (no requireAdmin middleware)
router.post('/login', AdminController.login as any);
router.post('/logout', requireAdmin as any, AdminController.logout as any);
router.get('/me', requireAdmin as any, AdminController.getCurrentUser as any);

// Driver management endpoints
router.get('/drivers', requireAdmin as any, AdminController.getDrivers as any);
router.post('/drivers', requireAdmin as any, AdminController.createDriver as any);
router.put('/drivers/:id', requireAdmin as any, AdminController.updateDriver as any);
router.put('/drivers/:id/verify', requireAdmin as any, AdminController.verifyDriver as any);
router.put('/drivers/:id/activate', requireAdmin as any, AdminController.activateDriver as any);

// Booking management endpoints
router.get('/bookings', requireAdmin as any, AdminController.getBookings as any);
router.get('/bookings/:id', requireAdmin as any, AdminController.getBooking as any);
router.put('/bookings/:id/cancel', requireAdmin as any, AdminController.cancelBooking as any);

// Stats endpoint
router.get('/stats', requireAdmin as any, AdminController.getStats as any);

export default router;