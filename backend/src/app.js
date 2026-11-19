import express from 'express';
import cors from 'cors';

import { createMoviesController } from './controllers/moviesController.js';
import { createCinemasController } from './controllers/cinemasController.js';
import { createMoviesRouter } from './routes/moviesRoutes.js';
import { createCinemasRouter } from './routes/cinemasRoutes.js';
import {
  centralErrorHandler,
  notFoundRouteHandler,
} from './middleware/errorHandler.js';
import {
  createMongoCinemaRepository,
  createMongoMovieRepository,
} from './repositories/mongoRepositories.js';

export function createApp(options = {}) {
  const movieRepo = options.movieRepo ?? createMongoMovieRepository();
  const cinemaRepo = options.cinemaRepo ?? createMongoCinemaRepository();
  const corsOrigin = options.corsOrigin ?? process.env.CORS_ORIGIN ?? '*';

  const app = express();

  app.use(
    cors({
      origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'doomsday-ready-backend',
      timestamp: new Date().toISOString(),
    });
  });

  const moviesController = createMoviesController(movieRepo);
  const cinemasController = createCinemasController(cinemaRepo);

  app.use('/api/movies', createMoviesRouter(moviesController));
  app.use('/api/cinemas', createCinemasRouter(cinemasController));

  app.use(notFoundRouteHandler);
  app.use(centralErrorHandler);

  return app;
}
