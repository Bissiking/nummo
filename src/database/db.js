// src/database/db.js
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config/env.js";
import { defaultCategories } from "./categories.js";

let database;

export function getDb() {
  if (!database) throw new Error("La base de données n'est pas initialisée.");
  return database;
}

export function initializeDatabase(databasePath = config.databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  database.exec(schema);

  const initialize = database.transaction(() => {
    let account = database.prepare("SELECT id FROM accounts ORDER BY id LIMIT 1").get();
    if (!account) {
      account = database.prepare("INSERT INTO accounts (name) VALUES (?) RETURNING id").get(config.defaultAccountName);
    }
    seedCategories(database);
  });
  initialize();
  return database;
}

function seedCategories(db) {
  const insert = db.prepare("INSERT INTO categories (account_id, name, parent_id, type, system_category) VALUES (NULL, ?, ?, ?, 1)");
  const find = db.prepare("SELECT id FROM categories WHERE account_id IS NULL AND name = ? AND parent_id IS ? AND system_category = 1 LIMIT 1");
  for (const category of defaultCategories) {
    let parent = find.get(category.name, null);
    if (!parent) parent = { id: insert.run(category.name, null, category.type).lastInsertRowid };
    for (const child of category.children) {
      if (!find.get(child, parent.id)) insert.run(child, parent.id, category.type);
    }
  }
}

export function closeDatabase() {
  if (database) database.close();
  database = undefined;
}
