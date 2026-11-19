import { Router } from 'express';

export function createCinemasRouter(controller) {
  const router = Router();

  router.get('/', controller.listCinemas);
  router.post('/', controller.createCinemas);
  router.get('/:id', controller.getCinemaById);
  router.delete('/:id', controller.deleteCinema);
  router.get('/:id/booking', controller.getBookingQuote);

  return router;
}
