// src/middleware/errors.js
import { AppError } from "../utils/errors.js";

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: "route_not_found", message: `Route inconnue : ${req.method} ${req.path}` } });
}

export function errorHandler(error, _req, res, _next) {
  const known = error instanceof AppError;
  const status = known ? error.status : 500;
  if (!known) console.error(error);
  res.status(status).json({
    error: {
      code: known ? error.code : "internal_error",
      message: known ? error.message : "Une erreur interne est survenue.",
      ...(known && error.details ? { details: error.details } : {})
    }
  });
}

export const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
