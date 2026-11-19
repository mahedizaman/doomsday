import { calculateMinBundles } from '../algorithms/minBundles.js';
import {
  duplicateNameError,
  notFoundError,
  validationError,
} from '../errors/AppError.js';
import { assertValidObjectId } from '../validators/movieValidator.js';
import {
  validateCreateCinemaPayload,
  validateGroupSizeQuery,
} from '../validators/cinemaValidator.js';

export function createCinemasController(cinemaRepo) {
  return {
    async listCinemas(_req, res, next) {
      try {
        const cinemas = await cinemaRepo.findAll();
        res.json(cinemas);
      } catch (err) {
        next(err);
      }
    },

    async getCinemaById(req, res, next) {
      try {
        assertValidObjectId(req.params.id, 'cinema id');
        const cinema = await cinemaRepo.findById(req.params.id);
        if (!cinema) {
          throw notFoundError(`Cinema with id "${req.params.id}" was not found.`);
        }
        res.json(cinema);
      } catch (err) {
        next(err);
      }
    },

    async createCinemas(req, res, next) {
      try {
        const isBatch = Array.isArray(req.body);
        const rawEntries = isBatch ? req.body : [req.body];

        if (isBatch && rawEntries.length === 0) {
          throw validationError('Request array must contain at least one cinema.');
        }

        const validatedEntries = rawEntries.map((entry) => validateCreateCinemaPayload(entry));

        // Reject duplicate names within the same batch (case-insensitive).
        const seenNames = new Set();
        for (const entry of validatedEntries) {
          const normalized = entry.name.toLowerCase();
          if (seenNames.has(normalized)) {
            throw duplicateNameError(entry.name);
          }
          seenNames.add(normalized);
        }

        const existingCinemas = await cinemaRepo.findAll();
        const existingNames = new Set(existingCinemas.map((c) => c.name.toLowerCase()));

        for (const entry of validatedEntries) {
          if (existingNames.has(entry.name.toLowerCase())) {
            throw duplicateNameError(entry.name);
          }
        }

        const created = await cinemaRepo.insertMany(validatedEntries);
        res.status(201).json(isBatch ? created : created[0]);
      } catch (err) {
        next(err);
      }
    },

    async deleteCinema(req, res, next) {
      try {
        const { id } = req.params;
        assertValidObjectId(id, 'cinema id');

        const deleted = await cinemaRepo.deleteById(id);
        if (!deleted) {
          throw notFoundError(`Cinema with id "${id}" was not found.`);
        }
        res.json({ deleted: true, id });
      } catch (err) {
        next(err);
      }
    },

    async getBookingQuote(req, res, next) {
      try {
        const { id } = req.params;
        assertValidObjectId(id, 'cinema id');

        const groupSize = validateGroupSizeQuery(req.query.groupSize);

        const cinema = await cinemaRepo.findById(id);
        if (!cinema) {
          throw notFoundError(`Cinema with id "${id}" was not found.`);
        }

        const quote = calculateMinBundles(cinema.bundleSizes, groupSize);

        res.json({
          cinema: {
            id: cinema.id,
            name: cinema.name,
          },
          groupSize,
          ...quote,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}
