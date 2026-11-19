import { Router } from 'express';

export function createMoviesRouter(controller) {
  const router = Router();

  router.get('/', controller.listMovies);
  router.post('/', controller.createMovies);
  router.get('/:id', controller.getMovieById);
  router.patch('/:id', controller.updateMovie);
  router.delete('/:id', controller.deleteMovie);
  router.get('/:id/rewatch-order', controller.getRewatchOrder);

  return router;
}
