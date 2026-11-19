import {
  buildAdjacencyMap,
  hasCircularDependency,
} from '../algorithms/cycleDetection.js';
import { computeRewatchOrder } from '../algorithms/rewatchOrder.js';
import {
  circularDependencyError,
  duplicateTitleError,
  notFoundError,
  validationError,
} from '../errors/AppError.js';
import {
  assertValidObjectId,
  validateCreateMoviePayload,
  validateUpdateMoviePayload,
} from '../validators/movieValidator.js';

export function createMoviesController(movieRepo) {
  return {
    async listMovies(_req, res, next) {
      try {
        const movies = await movieRepo.findAll();
        res.json(movies);
      } catch (err) {
        next(err);
      }
    },

    async getMovieById(req, res, next) {
      try {
        assertValidObjectId(req.params.id, 'movie id');
        const movie = await movieRepo.findById(req.params.id);
        if (!movie) {
          throw notFoundError(`Movie with id "${req.params.id}" was not found.`);
        }
        res.json(movie);
      } catch (err) {
        next(err);
      }
    },

    async createMovies(req, res, next) {
      try {
        const isBatch = Array.isArray(req.body);
        const rawEntries = isBatch ? req.body : [req.body];

        if (isBatch && rawEntries.length === 0) {
          throw validationError('Request array must contain at least one movie.');
        }

        const validatedEntries = rawEntries.map((entry) => validateCreateMoviePayload(entry));

        // Reject duplicate titles within the same batch (case-insensitive).
        const seenTitles = new Set();
        for (const entry of validatedEntries) {
          const normalized = entry.title.toLowerCase();
          if (seenTitles.has(normalized)) {
            throw duplicateTitleError(entry.title);
          }
          seenTitles.add(normalized);
        }

        const existingMovies = await movieRepo.findAll();
        const existingTitles = new Set(existingMovies.map((m) => m.title.toLowerCase()));
        const existingIds = new Set(existingMovies.map((m) => m.id));
        const adjacency = buildAdjacencyMap(existingMovies);

        const prepared = [];
        for (const entry of validatedEntries) {
          if (existingTitles.has(entry.title.toLowerCase())) {
            throw duplicateTitleError(entry.title);
          }

          const newId = movieRepo.generateId();

          // Verify all prerequisite IDs exist before creating.
          const missingIds = entry.prerequisites.filter((prereqId) => !existingIds.has(prereqId));
          if (missingIds.length > 0) {
            throw notFoundError(`Prerequisite movie(s) not found: ${missingIds.join(', ')}.`);
          }

          // Run pure cycle detection on create as well as update.
          if (hasCircularDependency(adjacency, newId, entry.prerequisites)) {
            throw circularDependencyError(
              `Adding prerequisites for "${entry.title}" would create a circular dependency.`
            );
          }

          adjacency.set(newId, entry.prerequisites);
          prepared.push({ id: newId, ...entry });
        }

        const created = await movieRepo.insertMany(prepared);
        res.status(201).json(isBatch ? created : created[0]);
      } catch (err) {
        next(err);
      }
    },

    async updateMovie(req, res, next) {
      try {
        const { id } = req.params;
        assertValidObjectId(id, 'movie id');

        const existing = await movieRepo.findById(id);
        if (!existing) {
          throw notFoundError(`Movie with id "${id}" was not found.`);
        }

        const updates = validateUpdateMoviePayload(req.body);

        if (updates.title !== undefined) {
          const duplicate = await movieRepo.findByNormalizedTitle(updates.title.toLowerCase());
          if (duplicate && duplicate.id !== id) {
            throw duplicateTitleError(updates.title);
          }
        }

        if (updates.prerequisites !== undefined) {
          const allMovies = await movieRepo.findAll();
          const existingIds = new Set(allMovies.map((m) => m.id));

          const missingIds = updates.prerequisites.filter(
            (prereqId) => !existingIds.has(prereqId)
          );
          if (missingIds.length > 0) {
            throw notFoundError(`Prerequisite movie(s) not found: ${missingIds.join(', ')}.`);
          }

          const adjacency = buildAdjacencyMap(allMovies);
          if (hasCircularDependency(adjacency, id, updates.prerequisites)) {
            const movieTitle = updates.title ?? existing.title;
            throw circularDependencyError(
              `Updating prerequisites for "${movieTitle}" would create a circular dependency.`
            );
          }
        }

        const updated = await movieRepo.updateById(id, updates);
        res.json(updated);
      } catch (err) {
        next(err);
      }
    },

    async deleteMovie(req, res, next) {
      try {
        const { id } = req.params;
        assertValidObjectId(id, 'movie id');

        const deleted = await movieRepo.deleteById(id);
        if (!deleted) {
          throw notFoundError(`Movie with id "${id}" was not found.`);
        }
        res.json({ deleted: true, id });
      } catch (err) {
        next(err);
      }
    },

    async getRewatchOrder(req, res, next) {
      try {
        const { id } = req.params;
        assertValidObjectId(id, 'movie id');

        const allMovies = await movieRepo.findAll();
        const exists = allMovies.some((m) => m.id === id);
        if (!exists) {
          throw notFoundError(`Movie with id "${id}" was not found.`);
        }

        const result = computeRewatchOrder(allMovies, id);
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}
