import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/verify', AuthController.verify as any);
router.post('/logout', requireAuth as any, AuthController.logout as any);

export default router;