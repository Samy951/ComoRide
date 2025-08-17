import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';
import { requireAuth, requireCustomer, requireDriver } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth as any, requireCustomer as any, BookingController.createBooking as any);
router.get('/:id', requireAuth as any, BookingController.getBooking as any);
router.put('/:id/accept', requireAuth as any, requireDriver as any, BookingController.acceptBooking as any);
router.put('/:id/cancel', requireAuth as any, BookingController.cancelBooking as any);

export default router;