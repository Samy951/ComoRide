import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import driverRoutes from './driver.routes';
import bookingRoutes from './booking.routes';

const router = Router();

router.use(healthRoutes);
router.use('/auth', authRoutes);
router.use('/drivers', driverRoutes);
router.use('/rides', bookingRoutes);

export default router;