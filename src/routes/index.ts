import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import driverRoutes from './driver.routes';
import bookingRoutes from './booking.routes';
import adminRoutes from './admin.routes';
import matchingRoutes from './matching.routes';
import customerRoutes from './customer.routes';

const router = Router();

router.use(healthRoutes);
router.use('/auth', authRoutes);
router.use('/drivers', driverRoutes);
router.use('/customers', customerRoutes);
router.use('/bookings', bookingRoutes);
router.use('/rides', bookingRoutes); // Alias pour compatibilité
router.use('/admin', adminRoutes);
router.use('/matching', matchingRoutes);

export default router;