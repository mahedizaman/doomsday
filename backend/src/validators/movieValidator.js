import { validationError } from '../errors/AppError.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
export const MIN_RELEASE_YEAR = 1888;
export const MAX_RELEASE_YEAR = 2100;
export const MIN_RUNTIME_MINUTES = 1;
export const MAX_RUNTIME_MINUTES = 300;
const MAX_TITLE_LENGTH = 200;

export function isValidObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_REGEX.test(value);
}

export function assertValidObjectId(value, label = 'id') {
  if (!isValidObjectId(value)) {
    throw validationError(`Invalid ${label} format: expected a 24-character hex ObjectId.`);
  }
}

function validateTitle(title) {
  if (typeof title !== 'string') {
    throw validationError('title is required and must be a string.');
  }
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw validationError('title cannot be empty.');
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw validationError(`title must be at most ${MAX_TITLE_LENGTH} characters.`);
  }
  return trimmed;
}

function validateReleaseYear(releaseYear) {
  if (typeof releaseYear !== 'number' || !Number.isInteger(releaseYear)) {
    throw validationError('releaseYear is required and must be an integer.');
  }
  if (releaseYear < MIN_RELEASE_YEAR || releaseYear > MAX_RELEASE_YEAR) {
    throw validationError(
      `releaseYear must be between ${MIN_RELEASE_YEAR} and ${MAX_RELEASE_YEAR} inclusive.`
    );
  }
  return releaseYear;
}

function validateRuntimeMinutes(runtimeMinutes) {
  if (typeof runtimeMinutes !== 'number' || !Number.isInteger(runtimeMinutes)) {
    throw validationError('runtimeMinutes is required and must be an integer.');
  }
  if (runtimeMinutes < MIN_RUNTIME_MINUTES || runtimeMinutes > MAX_RUNTIME_MINUTES) {
    throw validationError(
      `runtimeMinutes must be between ${MIN_RUNTIME_MINUTES} and ${MAX_RUNTIME_MINUTES} inclusive.`
    );
  }
  return runtimeMinutes;
}

function validatePrerequisites(prerequisites) {
  if (prerequisites === undefined) {
    return [];
  }
  if (!Array.isArray(prerequisites)) {
    throw validationError('prerequisites must be an array of movie IDs.');
  }
  const seen = new Set();
  const normalized = [];
  for (const rawId of prerequisites) {
    if (!isValidObjectId(rawId)) {
      throw validationError(
        `Invalid prerequisite ID "${String(rawId)}": expected a 24-character hex ObjectId.`
      );
    }
    if (seen.has(rawId)) {
      throw validationError(
        `Duplicate prerequisite ID "${rawId}" is not allowed inside prerequisites.`
      );
    }
    seen.add(rawId);
    normalized.push(rawId);
  }
  return normalized;
}

function validateWatched(watched) {
  if (watched === undefined) {
    return false;
  }
  if (typeof watched !== 'boolean') {
    throw validationError('watched must be a boolean.');
  }
  return watched;
}

export function validateCreateMoviePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw validationError('Each movie entry must be a JSON object.');
  }
  return {
    title: validateTitle(payload.title),
    releaseYear: validateReleaseYear(payload.releaseYear),
    runtimeMinutes: validateRuntimeMinutes(payload.runtimeMinutes),
    prerequisites: validatePrerequisites(payload.prerequisites),
    watched: validateWatched(payload.watched),
  };
}

export function validateUpdateMoviePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw validationError('Request body must be a JSON object.');
  }

  const updates = {};

  if (payload.title !== undefined) {
    updates.title = validateTitle(payload.title);
  }
  if (payload.releaseYear !== undefined) {
    updates.releaseYear = validateReleaseYear(payload.releaseYear);
  }
  if (payload.runtimeMinutes !== undefined) {
    updates.runtimeMinutes = validateRuntimeMinutes(payload.runtimeMinutes);
  }
  if (payload.prerequisites !== undefined) {
    updates.prerequisites = validatePrerequisites(payload.prerequisites);
  }
  if (payload.watched !== undefined) {
    updates.watched = validateWatched(payload.watched);
  }

  if (Object.keys(updates).length === 0) {
    throw validationError(
      'At least one updatable field (title, releaseYear, runtimeMinutes, prerequisites, watched) must be provided.'
    );
  }

  return updates;
}
