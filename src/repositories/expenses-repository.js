// src/repositories/expenses-repository.js
import { getDb } from "../database/db.js";

const expenseSelect = `SELECT e.*, c.name AS category_name, p.name AS parent_category_name FROM expenses e JOIN categories c ON c.id=e.category_id LEFT JOIN categories p ON p.id=c.parent_id`;

export function listExpenses(accountId, filters = {}) {
  const conditions = ["e.account_id = @accountId"];
  if (filters.categoryId) conditions.push("(e.category_id = @categoryId OR c.parent_id = @categoryId)");
  if (filters.from) conditions.push("e.expense_date >= @from");
  if (filters.to) conditions.push("e.expense_date <= @to");
  if (filters.search) conditions.push("(e.description LIKE @search OR e.note LIKE @search OR c.name LIKE @search)");
  if (filters.vehicle) conditions.push("(p.name = 'Véhicule' OR c.name = 'Véhicule')");
  return getDb().prepare(`${expenseSelect} WHERE ${conditions.join(" AND ")} ORDER BY e.expense_date DESC, e.id DESC`).all({ accountId, ...filters, search: filters.search ? `%${filters.search}%` : null });
}

export function findExpense(id, accountId) {
  return getDb().prepare(`${expenseSelect} WHERE e.id = ? AND e.account_id = ?`).get(id, accountId);
}

export function insertExpense(data) {
  const result = getDb().prepare(`INSERT INTO expenses (account_id, category_id, amount_cents, description, note, payment_method, expense_date, expense_type, is_recurring, deduct_from_balance, linked_transaction_id, fuel_type, fuel_liters, fuel_price_per_liter, vehicle_mileage) VALUES (@accountId,@categoryId,@amountCents,@description,@note,@paymentMethod,@date,@expenseType,@isRecurring,@deductFromBalance,@linkedTransactionId,@fuelType,@fuelLiters,@fuelPricePerLiter,@vehicleMileage)`).run(data);
  return findExpense(result.lastInsertRowid, data.accountId);
}

export function updateExpense(id, accountId, data) {
  getDb().prepare(`UPDATE expenses SET category_id=@categoryId, amount_cents=@amountCents, description=@description, note=@note, payment_method=@paymentMethod, expense_date=@date, expense_type=@expenseType, is_recurring=@isRecurring, deduct_from_balance=@deductFromBalance, linked_transaction_id=@linkedTransactionId, fuel_type=@fuelType, fuel_liters=@fuelLiters, fuel_price_per_liter=@fuelPricePerLiter, vehicle_mileage=@vehicleMileage, updated_at=CURRENT_TIMESTAMP WHERE id=@id AND account_id=@accountId`).run({ id, accountId, ...data });
  return findExpense(id, accountId);
}

export function removeExpense(id, accountId) {
  return getDb().prepare("DELETE FROM expenses WHERE id = ? AND account_id = ?").run(id, accountId).changes;
}
