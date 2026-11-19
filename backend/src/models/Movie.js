import mongoose from 'mongoose';

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    titleNormalized: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    releaseYear: {
      type: Number,
      required: true,
      min: 1888,
      max: 2100,
      validate: {
        validator: Number.isInteger,
        message: 'releaseYear must be an integer',
      },
    },
    runtimeMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 300,
      validate: {
        validator: Number.isInteger,
        message: 'runtimeMinutes must be an integer',
      },
    },
    prerequisites: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Movie',
        },
      ],
      default: [],
    },
    watched: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

movieSchema.pre('validate', function syncNormalizedTitle(next) {
  if (typeof this.title === 'string') {
    this.title = this.title.trim();
    this.titleNormalized = this.title.toLowerCase();
  }
  next();
});

export function serializeMovie(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(obj.id ?? obj._id),
    title: obj.title,
    releaseYear: obj.releaseYear,
    runtimeMinutes: obj.runtimeMinutes,
    prerequisites: Array.isArray(obj.prerequisites)
      ? obj.prerequisites.map((id) => String(id))
      : [],
    watched: Boolean(obj.watched),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export const Movie = mongoose.model('Movie', movieSchema);
