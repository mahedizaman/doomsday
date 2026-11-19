export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export const validationError = (message) =>
  new AppError(400, 'VALIDATION_ERROR', message);

export const notFoundError = (message) =>
  new AppError(404, 'NOT_FOUND', message);

export const circularDependencyError = (message) =>
  new AppError(409, 'CIRCULAR_DEPENDENCY', message);

export const duplicateTitleError = (title) =>
  new AppError(409, 'DUPLICATE_TITLE', `A movie with title "${title}" already exists.`);

export const duplicateNameError = (name) =>
  new AppError(409, 'DUPLICATE_NAME', `A cinema with name "${name}" already exists.`);
