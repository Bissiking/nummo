// src/repositories/transactions-repository.js
import { getDb } from "../database/db.js";

export function transactionBalance(accountId, excludeId = null) {
  return getDb().prepare(`SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount_cents ELSE -amount_cents END), 0) AS balance FROM transactions WHERE account_id = ? AND (? IS NULL OR id != ?)`)
    .get(accountId, excludeId, excludeId).balance;
}

export function listTransactions(accountId, filters = {}) {
  const conditions = ["account_id = @accountId"];
  if (filters.type) conditions.push("type = @type");
  if (filters.from) conditions.push("transaction_date >= @from");
  if (filters.to) conditions.push("transaction_date <= @to");
  if (filters.search) conditions.push("(description LIKE @search OR note LIKE @search)");
  return getDb().prepare(`SELECT * FROM transactions WHERE ${conditions.join(" AND ")} ORDER BY transaction_date DESC, id DESC`).all({ accountId, ...filters, search: filters.search ? `%${filters.search}%` : null });
}

export function findTransaction(id, accountId) {
  return getDb().prepare("SELECT * FROM transactions WHERE id = ? AND account_id = ?").get(id, accountId);
}

export function insertTransaction(data) {
  const result = getDb().prepare(`INSERT INTO transactions (account_id, type, amount_cents, description, note, transaction_date) VALUES (@accountId, @type, @amountCents, @description, @note, @date)`).run(data);
  return findTransaction(result.lastInsertRowid, data.accountId);
}

export function updateTransaction(id, accountId, data) {
  getDb().prepare(`UPDATE transactions SET type=@type, amount_cents=@amountCents, description=@description, note=@note, transaction_date=@date, updated_at=CURRENT_TIMESTAMP WHERE id=@id AND account_id=@accountId`).run({ id, accountId, ...data });
  return findTransaction(id, accountId);
}

export function removeTransaction(id, accountId) {
  return getDb().prepare("DELETE FROM transactions WHERE id = ? AND account_id = ?").run(id, accountId).changes;
}
