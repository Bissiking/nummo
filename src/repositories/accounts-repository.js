// src/repositories/accounts-repository.js
import { getDb } from "../database/db.js";

const accountFields = "id, name, kyros_user_id, created_at, updated_at";

export function ensureAccountForIdentity(identity) {
  const db = getDb();
  if (identity?.provider !== "kyros") return db.prepare(`SELECT ${accountFields} FROM accounts ORDER BY created_at LIMIT 1`).get();

  return db.transaction(() => {
    let account = db.prepare(`SELECT ${accountFields} FROM accounts WHERE kyros_user_id = ?`).get(identity.subject);
    const displayName = String(identity.displayName || identity.username || "Compte Kyros").trim().slice(0, 100) || "Compte Kyros";
    if (!account) {
      const unassigned = db.prepare("SELECT id FROM accounts WHERE kyros_user_id IS NULL ORDER BY created_at LIMIT 1").get();
      if (unassigned) {
        db.prepare("UPDATE accounts SET name = ?, kyros_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(displayName, identity.subject, unassigned.id);
        account = db.prepare(`SELECT ${accountFields} FROM accounts WHERE id = ?`).get(unassigned.id);
      } else {
        account = db.prepare(`INSERT INTO accounts (name, kyros_user_id) VALUES (?, ?) RETURNING ${accountFields}`).get(displayName, identity.subject);
      }
    } else if (account.name !== displayName) {
      db.prepare("UPDATE accounts SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(displayName, account.id);
      account = db.prepare(`SELECT ${accountFields} FROM accounts WHERE id = ?`).get(account.id);
    }
    db.prepare("INSERT OR IGNORE INTO account_memberships (account_id, kyros_user_id, role) VALUES (?, ?, 'manager')").run(account.id, identity.subject);
    return account;
  })();
}

export function listAccountsForIdentity(identity) {
  if (identity?.provider !== "kyros") return getDb().prepare(`SELECT ${accountFields} FROM accounts ORDER BY created_at`).all();
  return getDb().prepare(`SELECT DISTINCT a.${accountFields.replaceAll(", ", ", a.")} FROM accounts a LEFT JOIN account_memberships m ON m.account_id = a.id WHERE a.kyros_user_id = ? OR m.kyros_user_id = ? ORDER BY a.created_at`).all(identity.subject, identity.subject);
}

export function findAccountForIdentity(id, identity) {
  if (identity?.provider !== "kyros") return getDb().prepare(`SELECT ${accountFields} FROM accounts WHERE id = ?`).get(id);
  return getDb().prepare(`SELECT DISTINCT a.${accountFields.replaceAll(", ", ", a.")} FROM accounts a LEFT JOIN account_memberships m ON m.account_id = a.id WHERE a.id = ? AND (a.kyros_user_id = ? OR m.kyros_user_id = ?)`).get(id, identity.subject, identity.subject);
}
