// src/services/expenses-service.js
import { getDb } from "../database/db.js";
import * as categories from "../repositories/categories-repository.js";
import * as expenses from "../repositories/expenses-repository.js";
import * as transactions from "../repositories/transactions-repository.js";
import { AppError, notFound } from "../utils/errors.js";
import { booleanInt, enumValue, isoDate, optionalPositiveNumber, optionalText, positiveCents, positiveId, requiredText } from "../utils/validation.js";

const fuelTypes = ["Essence", "Gasoil", "E85", "GPL", "Électricité", "Autre"];

function normalize(accountId, input) {
  const categoryId = positiveId(input.category_id ?? input.categoryId, "Catégorie");
  const category = categories.findCategory(categoryId, accountId);
  if (!category) throw new AppError(400, "La catégorie sélectionnée n'existe pas.", "invalid_category");
  const fuelType = optionalText(input.fuel_type ?? input.fuelType, 30);
  if (fuelType && !fuelTypes.includes(fuelType)) throw new AppError(400, "Type de carburant invalide.", "invalid_fuel_type");
  return {
    categoryId,
    amountCents: positiveCents(input.amount_cents ?? input.amountCents),
    description: requiredText(input.description, "La description"),
    note: optionalText(input.note),
    paymentMethod: optionalText(input.payment_method ?? input.paymentMethod, 80),
    date: isoDate(input.expense_date ?? input.date, "La date de dépense"),
    expenseType: enumValue(input.expense_type ?? input.expenseType ?? category.type, ["FIXED", "VARIABLE"], "Type de dépense"),
    isRecurring: booleanInt(input.is_recurring ?? input.isRecurring),
    deductFromBalance: booleanInt(input.deduct_from_balance ?? input.deductFromBalance),
    fuelType,
    fuelLiters: optionalPositiveNumber(input.fuel_liters ?? input.fuelLiters, "Le nombre de litres"),
    fuelPricePerLiter: optionalPositiveNumber(input.fuel_price_per_liter ?? input.fuelPricePerLiter, "Le prix au litre"),
    vehicleMileage: input.vehicle_mileage === "" || input.vehicle_mileage == null ? null : Math.round(optionalPositiveNumber(input.vehicle_mileage, "Le kilométrage"))
  };
}

function assertFunds(accountId, amountCents, excludeTransactionId = null) {
  if (amountCents > transactions.transactionBalance(accountId, excludeTransactionId)) {
    throw new AppError(422, "Cette dépense dépasse le solde détenu. Décochez la déduction ou ajoutez un dépôt.", "insufficient_balance");
  }
}

export function list(accountId, filters) { return expenses.listExpenses(accountId, filters); }

export function create(accountId, input) {
  const data = normalize(accountId, input);
  return getDb().transaction(() => {
    let linkedTransactionId = null;
    if (data.deductFromBalance) {
      assertFunds(accountId, data.amountCents);
      linkedTransactionId = transactions.insertTransaction({ accountId, type: "withdrawal", amountCents: data.amountCents, description: `Dépense · ${data.description}`, note: data.note, date: data.date }).id;
    }
    return expenses.insertExpense({ accountId, ...data, linkedTransactionId });
  })();
}

export function update(accountId, id, input) {
  const current = expenses.findExpense(id, accountId);
  if (!current) throw notFound("Dépense");
  const data = normalize(accountId, input);
  return getDb().transaction(() => {
    let linkedTransactionId = current.linked_transaction_id;
    if (data.deductFromBalance) {
      assertFunds(accountId, data.amountCents, linkedTransactionId);
      const transactionData = { type: "withdrawal", amountCents: data.amountCents, description: `Dépense · ${data.description}`, note: data.note, date: data.date };
      if (linkedTransactionId) transactions.updateTransaction(linkedTransactionId, accountId, transactionData);
      else linkedTransactionId = transactions.insertTransaction({ accountId, ...transactionData }).id;
    } else if (linkedTransactionId) {
      expenses.updateExpense(id, accountId, { ...data, linkedTransactionId: null });
      transactions.removeTransaction(linkedTransactionId, accountId);
      linkedTransactionId = null;
    }
    return expenses.updateExpense(id, accountId, { ...data, linkedTransactionId });
  })();
}

export function remove(accountId, id) {
  const current = expenses.findExpense(id, accountId);
  if (!current) throw notFound("Dépense");
  getDb().transaction(() => {
    const linkedId = current.linked_transaction_id;
    expenses.removeExpense(id, accountId);
    if (linkedId) transactions.removeTransaction(linkedId, accountId);
  })();
}
