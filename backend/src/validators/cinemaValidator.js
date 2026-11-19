import { validationError } from '../errors/AppError.js';

export const MIN_BUNDLE_COUNT = 1;
export const MAX_BUNDLE_COUNT = 10;
export const MIN_BUNDLE_SIZE = 1;
export const MAX_BUNDLE_SIZE = 500;
export const MIN_GROUP_SIZE = 1;
export const MAX_GROUP_SIZE = 10000;
const MAX_NAME_LENGTH = 200;

function validateCinemaName(name) {
  if (typeof name !== 'string') {
    throw validationError('name is required and must be a string.');
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw validationError('name cannot be empty.');
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw validationError(`name must be at most ${MAX_NAME_LENGTH} characters.`);
  }
  return trimmed;
}

function validateBundleSizes(bundleSizes) {
  if (!Array.isArray(bundleSizes)) {
    throw validationError('bundleSizes is required and must be an array of integers.');
  }
  if (bundleSizes.length < MIN_BUNDLE_COUNT || bundleSizes.length > MAX_BUNDLE_COUNT) {
    throw validationError(
      `bundleSizes must contain between ${MIN_BUNDLE_COUNT} and ${MAX_BUNDLE_COUNT} sizes.`
    );
  }

  const seen = new Set();
  for (const size of bundleSizes) {
    if (typeof size !== 'number' || !Number.isInteger(size)) {
      throw validationError('Every bundle size must be an integer.');
    }
    if (size < MIN_BUNDLE_SIZE || size > MAX_BUNDLE_SIZE) {
      throw validationError(
        `Every bundle size must be between ${MIN_BUNDLE_SIZE} and ${MAX_BUNDLE_SIZE} inclusive.`
      );
    }
    if (seen.has(size)) {
      throw validationError(`Duplicate bundle size ${size} is not allowed.`);
    }
    seen.add(size);
  }

  // Store sorted ascending for consistent presentation.
  return [...bundleSizes].sort((a, b) => a - b);
}

export function validateCreateCinemaPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw validationError('Each cinema entry must be a JSON object.');
  }
  return {
    name: validateCinemaName(payload.name),
    bundleSizes: validateBundleSizes(payload.bundleSizes),
  };
}

export function validateGroupSizeQuery(rawGroupSize) {
  if (rawGroupSize === undefined || rawGroupSize === null || rawGroupSize === '') {
    throw validationError(
      `groupSize query parameter is required and must be an integer between ${MIN_GROUP_SIZE} and ${MAX_GROUP_SIZE}.`
    );
  }
  const str = String(rawGroupSize).trim();
  if (!/^\d+$/.test(str)) {
    throw validationError(
      `groupSize must be an integer between ${MIN_GROUP_SIZE} and ${MAX_GROUP_SIZE}.`
    );
  }
  const parsed = Number.parseInt(str, 10);
  if (!Number.isSafeInteger(parsed) || parsed < MIN_GROUP_SIZE || parsed > MAX_GROUP_SIZE) {
    throw validationError(
      `groupSize must be an integer between ${MIN_GROUP_SIZE} and ${MAX_GROUP_SIZE}.`
    );
  }
  return parsed;
}
