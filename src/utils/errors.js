// src/utils/errors.js
export class AppError extends Error {
  constructor(status, message, code = "application_error", details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (resource = "Ressource") => new AppError(404, `${resource} introuvable.`, "not_found");
