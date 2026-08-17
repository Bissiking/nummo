// src/repositories/income-sources-repository.js
import { getDb } from "../database/db.js";

export function listIncomeSources(accountId) {
  return getDb().prepare("SELECT * FROM income_sources WHERE account_id=? ORDER BY description").all(accountId);
}

export function findIncomeSource(id, accountId) {
  return getDb().prepare("SELECT * FROM income_sources WHERE id=? AND account_id=?").get(id, accountId);
}

export function saveIncomeSource(data, id = null) {
  if (id) getDb().prepare("UPDATE income_sources SET description=@description, updated_at=CURRENT_TIMESTAMP WHERE id=@id AND account_id=@accountId").run({ ...data, id });
  else id = getDb().prepare("INSERT INTO income_sources (account_id, description) VALUES (@accountId, @description)").run(data).lastInsertRowid;
  return getDb().prepare("SELECT * FROM income_sources WHERE id=?").get(id);
}

export function deleteIncomeSource(id, accountId) {
  return getDb().prepare("DELETE FROM income_sources WHERE id=? AND account_id=?").run(id, accountId).changes;
}