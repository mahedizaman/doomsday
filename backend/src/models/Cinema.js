import mongoose from 'mongoose';

const cinemaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameNormalized: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    bundleSizes: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr) =>
          Array.isArray(arr) &&
          arr.length >= 1 &&
          arr.length <= 10 &&
          new Set(arr).size === arr.length &&
          arr.every((n) => Number.isInteger(n) && n >= 1 && n <= 500),
        message: 'bundleSizes must contain 1 to 10 distinct integers between 1 and 500',
      },
    },
  },
  {
    timestamps: true,
  }
);

cinemaSchema.pre('validate', function syncNormalizedName(next) {
  if (typeof this.name === 'string') {
    this.name = this.name.trim();
    this.nameNormalized = this.name.toLowerCase();
  }
  next();
});

export function serializeCinema(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(obj.id ?? obj._id),
    name: obj.name,
    bundleSizes: Array.isArray(obj.bundleSizes) ? [...obj.bundleSizes] : [],
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export const Cinema = mongoose.model('Cinema', cinemaSchema);
