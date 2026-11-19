import { AppError } from '../errors/AppError.js';

export function notFoundRouteHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found.`,
    },
  });
}

export function centralErrorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // Malformed JSON request body from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid JSON payload.',
      },
    });
  }

  // Mongoose duplicate key fallback (race condition protection)
  if (err && err.code === 11000) {
    const keyPattern = err.keyPattern || {};
    if (keyPattern.titleNormalized) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_TITLE',
          message: 'A movie with that title already exists.',
        },
      });
    }
    if (keyPattern.nameNormalized) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_NAME',
          message: 'A cinema with that name already exists.',
        },
      });
    }
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A record with that unique value already exists.',
      },
    });
  }

  // Mongoose CastError / ValidationError fallback
  if (err && (err.name === 'CastError' || err.name === 'ValidationError')) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message || 'Validation failed.',
      },
    });
  }

  console.error('Unhandled server error:', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
    },
  });
}
