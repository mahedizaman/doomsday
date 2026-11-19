import mongoose from 'mongoose';
import { Movie, serializeMovie } from '../models/Movie.js';
import { Cinema, serializeCinema } from '../models/Cinema.js';

export function createMongoMovieRepository() {
  return {
    generateId() {
      return new mongoose.Types.ObjectId().toString();
    },

    async findAll() {
      const docs = await Movie.find().sort({ releaseYear: 1, titleNormalized: 1 }).lean();
      return docs.map(serializeMovie);
    },

    async findById(id) {
      const doc = await Movie.findById(id).lean();
      return serializeMovie(doc);
    },

    async findByNormalizedTitle(titleNormalized) {
      const doc = await Movie.findOne({ titleNormalized }).lean();
      return serializeMovie(doc);
    },

    async insertMany(items) {
      const docsToInsert = items.map((item) => ({
        _id: item.id ? new mongoose.Types.ObjectId(item.id) : new mongoose.Types.ObjectId(),
        title: item.title,
        titleNormalized: item.title.toLowerCase(),
        releaseYear: item.releaseYear,
        runtimeMinutes: item.runtimeMinutes,
        prerequisites: (item.prerequisites || []).map((p) => new mongoose.Types.ObjectId(p)),
        watched: Boolean(item.watched),
      }));
      const inserted = await Movie.insertMany(docsToInsert, { ordered: true });
      return inserted.map(serializeMovie);
    },

    async updateById(id, updates) {
      const payload = { ...updates };
      if (typeof payload.title === 'string') {
        payload.title = payload.title.trim();
        payload.titleNormalized = payload.title.toLowerCase();
      }
      if (Array.isArray(payload.prerequisites)) {
        payload.prerequisites = payload.prerequisites.map((p) => new mongoose.Types.ObjectId(p));
      }
      const updated = await Movie.findByIdAndUpdate(
        id,
        { $set: payload },
        { new: true, runValidators: true }
      ).lean();
      return serializeMovie(updated);
    },

    async deleteById(id) {
      const deleted = await Movie.findByIdAndDelete(id).lean();
      if (!deleted) {
        return false;
      }
      // Remove dangling references from any other movies that depended on this movie.
      await Movie.updateMany(
        { prerequisites: deleted._id },
        { $pull: { prerequisites: deleted._id } }
      );
      return true;
    },

    async count() {
      return Movie.countDocuments();
    },
  };
}

export function createMongoCinemaRepository() {
  return {
    async findAll() {
      const docs = await Cinema.find().sort({ nameNormalized: 1 }).lean();
      return docs.map(serializeCinema);
    },

    async findById(id) {
      const doc = await Cinema.findById(id).lean();
      return serializeCinema(doc);
    },

    async findByNormalizedName(nameNormalized) {
      const doc = await Cinema.findOne({ nameNormalized }).lean();
      return serializeCinema(doc);
    },

    async insertMany(items) {
      const docsToInsert = items.map((item) => ({
        name: item.name,
        nameNormalized: item.name.toLowerCase(),
        bundleSizes: [...item.bundleSizes],
      }));
      const inserted = await Cinema.insertMany(docsToInsert, { ordered: true });
      return inserted.map(serializeCinema);
    },

    async deleteById(id) {
      const deleted = await Cinema.findByIdAndDelete(id).lean();
      return Boolean(deleted);
    },

    async count() {
      return Cinema.countDocuments();
    },
  };
}
