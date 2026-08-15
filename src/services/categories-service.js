// src/services/categories-service.js
import * as repository from "../repositories/categories-repository.js";
import { AppError, notFound } from "../utils/errors.js";
import { enumValue, positiveId, requiredText } from "../utils/validation.js";

function normalize(accountId, input, selfId = null) {
  const parentId = input.parent_id || input.parentId ? positiveId(input.parent_id ?? input.parentId, "Catégorie parente") : null;
  if (parentId === selfId) throw new AppError(400, "Une catégorie ne peut pas être son propre parent.", "invalid_parent");
  if (parentId && !repository.findCategory(parentId, accountId)) throw new AppError(400, "La catégorie parente n'existe pas.", "invalid_parent");
  return {
    accountId,
    name: requiredText(input.name, "Le nom", 80),
    parentId,
    type: enumValue(input.type || "VARIABLE", ["FIXED", "VARIABLE"], "Type de catégorie")
  };
}

export function list(accountId) { return repository.listCategories(accountId); }
export function create(accountId, input) { return repository.createCategory(normalize(accountId, input)); }
export function update(accountId, id, input) {
  const current = repository.findCategory(id, accountId);
  if (!current) throw notFound("Catégorie");
  if (current.system_category) throw new AppError(403, "Les catégories système sont protégées.", "system_category");
  return repository.updateCategory(id, accountId, normalize(accountId, input, id));
}
export function remove(accountId, id) {
  const current = repository.findCategory(id, accountId);
  if (!current) throw notFound("Catégorie");
  if (current.system_category) throw new AppError(403, "Les catégories système sont protégées.", "system_category");
  try {
    if (!repository.deleteCategory(id, accountId)) throw notFound("Catégorie");
  } catch (error) {
    if (String(error.code).startsWith("SQLITE_CONSTRAINT")) throw new AppError(409, "Cette catégorie est encore utilisée.", "category_in_use");
    throw error;
  }
}
