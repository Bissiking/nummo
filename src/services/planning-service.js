// src/services/planning-service.js
import * as categories from "../repositories/categories-repository.js";
import * as repository from "../repositories/planning-repository.js";
import { AppError, notFound } from "../utils/errors.js";
import { booleanInt, enumValue, isoDate, positiveCents, positiveId, requiredText } from "../utils/validation.js";

function ensureCategory(accountId, value) {
  const id = positiveId(value, "Catégorie");
  if (!categories.findCategory(id, accountId)) throw new AppError(400, "La catégorie sélectionnée n'existe pas.", "invalid_category");
  return id;
}

function recurringData(accountId, input) {
  const interval = Number.parseInt(input.interval || 1, 10);
  if (!Number.isSafeInteger(interval) || interval <= 0) throw new AppError(400, "L'intervalle doit être positif.", "invalid_interval");
  return { accountId, categoryId: ensureCategory(accountId, input.category_id ?? input.categoryId), name: requiredText(input.name, "Le nom"), amountCents: positiveCents(input.amount_cents ?? input.amountCents), frequency: enumValue(input.frequency, ["weekly", "monthly", "quarterly", "semiannual", "annual", "custom"], "Fréquence"), interval, nextDueDate: isoDate(input.next_due_date ?? input.nextDueDate, "La prochaine échéance"), active: input.active === undefined ? 1 : booleanInt(input.active) };
}

export function listRecurring(accountId) { return repository.listRecurring(accountId); }
export function createRecurring(accountId, input) { return repository.saveRecurring(recurringData(accountId, input)); }
export function updateRecurring(accountId, id, input) { if (!repository.findRecurring(id, accountId)) throw notFound("Dépense récurrente"); if (repository.recurringProject(id, accountId)) throw new AppError(409, "Cette récurrence est gérée depuis son projet.", "project_recurring_locked"); return repository.saveRecurring(recurringData(accountId, input), id); }
export function deleteRecurring(accountId, id) { if (repository.recurringProject(id, accountId)) throw new AppError(409, "Supprimez le projet pour retirer cette récurrence.", "project_recurring_locked"); if (!repository.deleteRecurring(id, accountId)) throw notFound("Dépense récurrente"); }

function budgetData(accountId, input) { return { accountId, categoryId: ensureCategory(accountId, input.category_id ?? input.categoryId), amountCents: positiveCents(input.amount_cents ?? input.amountCents) }; }
export function listBudgets(accountId) { return repository.listBudgets(accountId); }
export function createBudget(accountId, input) { try { return repository.saveBudget(budgetData(accountId, input)); } catch (error) { if (error.code === "SQLITE_CONSTRAINT_UNIQUE") throw new AppError(409, "Un budget existe déjà pour cette catégorie.", "budget_exists"); throw error; } }
export function updateBudget(accountId, id, input) { if (!repository.findBudget(id, accountId)) throw notFound("Budget"); return repository.saveBudget(budgetData(accountId, input), id); }
export function deleteBudget(accountId, id) { if (!repository.deleteBudget(id, accountId)) throw notFound("Budget"); }
