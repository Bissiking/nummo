// src/repositories/categories-repository.js
import { getDb } from "../database/db.js";

export function listCategories(accountId) {
  return getDb().prepare(`
    SELECT c.*, p.name AS parent_name
    FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
    WHERE c.account_id IS NULL OR c.account_id = ?
    ORDER BY c.parent_id IS NOT NULL, COALESCE(p.name, c.name), c.name
  `).all(accountId);
}

export function findCategory(id, accountId) {
  return getDb().prepare("SELECT * FROM categories WHERE id = ? AND (account_id IS NULL OR account_id = ?)").get(id, accountId);
}

export function createCategory(data) {
  const result = getDb().prepare("INSERT INTO categories (account_id, name, parent_id, type, system_category) VALUES (?, ?, ?, ?, 0)").run(data.accountId, data.name, data.parentId, data.type);
  return findCategory(result.lastInsertRowid, data.accountId);
}

export function updateCategory(id, accountId, data) {
  getDb().prepare("UPDATE categories SET name = ?, parent_id = ?, type = ? WHERE id = ? AND account_id = ? AND system_category = 0").run(data.name, data.parentId, data.type, id, accountId);
  return findCategory(id, accountId);
}

export function deleteCategory(id, accountId) {
  return getDb().prepare("DELETE FROM categories WHERE id = ? AND account_id = ? AND system_category = 0").run(id, accountId).changes;
}
