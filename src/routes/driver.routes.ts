import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller';
import { requireAuth, requireDriver } from '../middleware/auth.middleware';

const router = Router();

router.put('/availability', requireAuth as any, requireDriver as any, DriverController.updateAvailability as any);
router.put('/location', requireAuth as any, requireDriver as any, DriverController.updateLocation as any);

export default router;