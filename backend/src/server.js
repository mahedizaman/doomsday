import 'dotenv/config';
import mongoose from 'mongoose';

import { createApp } from './app.js';
import {
  createMongoCinemaRepository,
  createMongoMovieRepository,
} from './repositories/mongoRepositories.js';
import { seedDatabase } from './seed/seedData.js';

const PORT = Number.parseInt(process.env.PORT || '4000', 10);
const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/doomsday_ready';

async function connectWithRetry(uri, retries = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri);
      console.log(`Connected to MongoDB (${uri})`);
      return;
    } catch (err) {
      console.warn(
        `MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`
      );
      if (attempt === retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function start() {
  await connectWithRetry(MONGO_URI);

  const movieRepo = createMongoMovieRepository();
  const cinemaRepo = createMongoCinemaRepository();

  const { seededMovies, seededCinemas } = await seedDatabase(movieRepo, cinemaRepo);
  if (seededMovies > 0 || seededCinemas > 0) {
    console.log(
      `Seeded initial data: ${seededMovies} movies, ${seededCinemas} cinemas.`
    );
  }

  const app = createApp({ movieRepo, cinemaRepo });
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Doomsday Ready API listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
