// src/utils/validation.js
import { AppError } from "./errors.js";

export function positiveId(value, label = "identifiant") {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new AppError(400, `${label} invalide.`, "invalid_id");
  return parsed;
}

export function positiveCents(value, label = "montant") {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new AppError(400, `Le ${label} doit être supérieur à zéro.`, "invalid_amount");
  return parsed;
}

export function requiredText(value, label, max = 180) {
  const text = String(value ?? "").trim();
  if (!text) throw new AppError(400, `${label} est requis.`, "missing_field");
  if (text.length > max) throw new AppError(400, `${label} ne peut pas dépasser ${max} caractères.`, "field_too_long");
  return text;
}

export function optionalText(value, max = 2000) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (text.length > max) throw new AppError(400, `Une valeur ne peut pas dépasser ${max} caractères.`, "field_too_long");
  return text || null;
}

export function isoDate(value, label = "La date") {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new AppError(400, `${label} est invalide.`, "invalid_date");
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new AppError(400, `${label} est invalide.`, "invalid_date");
  return text;
}

export function enumValue(value, allowed, label) {
  if (!allowed.includes(value)) throw new AppError(400, `${label} invalide.`, "invalid_value");
  return value;
}

export function booleanInt(value) {
  return value === true || value === 1 || value === "1" ? 1 : 0;
}

export function optionalPositiveNumber(value, label) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new AppError(400, `${label} doit être positif.`, "invalid_number");
  return number;
}
