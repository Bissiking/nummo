// src/repositories/planning-repository.js
import { getDb } from "../database/db.js";

export function listRecurring(accountId) {
  return getDb().prepare(`SELECT r.*, c.name AS category_name, p.name AS parent_category_name, project.id AS project_id FROM recurring_expenses r JOIN categories c ON c.id=r.category_id LEFT JOIN categories p ON p.id=c.parent_id LEFT JOIN projects project ON project.recurring_expense_id=r.id WHERE r.account_id=? ORDER BY r.active DESC, r.next_due_date`).all(accountId);
}
export function findRecurring(id, accountId) { return getDb().prepare("SELECT * FROM recurring_expenses WHERE id=? AND account_id=?").get(id, accountId); }
export function recurringProject(id, accountId) { return getDb().prepare("SELECT id FROM projects WHERE recurring_expense_id=? AND account_id=?").get(id, accountId); }
export function saveRecurring(data, id = null) {
  if (id) getDb().prepare(`UPDATE recurring_expenses SET category_id=@categoryId,name=@name,amount_cents=@amountCents,frequency=@frequency,interval=@interval,next_due_date=@nextDueDate,active=@active,updated_at=CURRENT_TIMESTAMP WHERE id=@id AND account_id=@accountId`).run({ ...data, id });
  else id = getDb().prepare(`INSERT INTO recurring_expenses (account_id,category_id,name,amount_cents,frequency,interval,next_due_date,active) VALUES (@accountId,@categoryId,@name,@amountCents,@frequency,@interval,@nextDueDate,@active)`).run(data).lastInsertRowid;
  return getDb().prepare("SELECT * FROM recurring_expenses WHERE id=?").get(id);
}
export function deleteRecurring(id, accountId) { return getDb().prepare("DELETE FROM recurring_expenses WHERE id=? AND account_id=?").run(id, accountId).changes; }

export function listBudgets(accountId) {
  return getDb().prepare(`SELECT b.*, c.name AS category_name, p.name AS parent_category_name, COALESCE((SELECT SUM(e.amount_cents) FROM expenses e JOIN categories ec ON ec.id=e.category_id WHERE e.account_id=b.account_id AND (e.category_id=b.category_id OR ec.parent_id=b.category_id) AND strftime('%Y-%m',e.expense_date)=strftime('%Y-%m','now')),0) AS used_cents FROM budgets b JOIN categories c ON c.id=b.category_id LEFT JOIN categories p ON p.id=c.parent_id WHERE b.account_id=? ORDER BY c.name`).all(accountId);
}
export function findBudget(id, accountId) { return getDb().prepare("SELECT * FROM budgets WHERE id=? AND account_id=?").get(id, accountId); }
export function saveBudget(data, id = null) {
  if (id) getDb().prepare(`UPDATE budgets SET category_id=@categoryId,amount_cents=@amountCents,period='monthly',updated_at=CURRENT_TIMESTAMP WHERE id=@id AND account_id=@accountId`).run({ ...data, id });
  else id = getDb().prepare(`INSERT INTO budgets (account_id,category_id,amount_cents,period) VALUES (@accountId,@categoryId,@amountCents,'monthly')`).run(data).lastInsertRowid;
  return getDb().prepare("SELECT * FROM budgets WHERE id=?").get(id);
}
export function deleteBudget(id, accountId) { return getDb().prepare("DELETE FROM budgets WHERE id=? AND account_id=?").run(id, accountId).changes; }
