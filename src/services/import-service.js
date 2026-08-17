// src/services/import-service.js
import { getDb } from "../database/db.js";

const RECURRING_MARKERS = /(PRLV|PRELEV|VIR|ABO)/;
const PERIODS = [["weekly", 7, 1], ["monthly", 30, 4], ["quarterly", 90, 8], ["semiannual", 180, 15], ["annual", 365, 20]];

function normalizeLabel(label) {
  return String(label).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

function baseLabel(label) {
  const tokens = normalizeLabel(label).split(" ");
  while (tokens.length > 1 && tokens[tokens.length - 1].length >= 8 && /^[A-Z0-9]+$/.test(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

function splitRow(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else quoted = false;
      } else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ";") { cells.push(current); current = ""; }
    else current += char;
  }
  cells.push(current);
  return cells;
}

function parseDate(value) {
  const match = String(value ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseAmount(value) {
  const text = String(value ?? "").replace(/[ \u00a0\u202f]/g, "").replace(",", ".").replace(/[+€\s]/g, "");
  const number = Number.parseFloat(text);
  if (!Number.isFinite(number) || number === 0) return null;
  return Math.round(Math.abs(number) * 100);
}

function parseRows(csvText) {
  const rows = [];
  const lines = String(csvText ?? "").split(/\r?\n/);
  for (const line of lines) {
    const cells = splitRow(line);
    if (cells.length < 5) continue;
    if (/^date/i.test(cells[0].trim())) continue;
    const date = parseDate(cells[0]);
    const label = String(cells[4] ?? "").trim();
    if (!date || !label) continue;
    const debit = parseAmount(cells[2]);
    const credit = parseAmount(cells[3]);
    if (debit != null) rows.push({ date, amountCents: debit, type: "withdrawal", label });
    else if (credit != null) rows.push({ date, amountCents: credit, type: "deposit", label });
  }
  return rows;
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function detectPeriod(deltas) {
  const sorted = [...deltas].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  for (const [name, base, tolerance] of PERIODS) {
    if (Math.abs(median - base) > tolerance) continue;
    if (sorted.every((delta) => Math.abs(delta - median) <= Math.max(5, median * 0.25))) return name;
  }
  return null;
}

const CATEGORY_RULES = [
  [["IMPOT", "TAXE", "DGFIP", "URSSAF", "FISC", "REDEVANCE", "AME DU", "CONTRIBUTION"], "Administratif"],
  [["LOYER", "CREDIT LOGEMENT", "COPROPRIETE", "HABITATION"], "Loyer / crédit"],
  [["EDF", "ENGIE", "ELECTRICITE"], "Électricité"],
  [["GAZ"], "Gaz"],
  [["VEOLIA", "LYONNAISE"], "Eau"],
  [["INTERNET", "FIBRE", "LIVEBOX", "FREEBOX"], "Internet"],
  [["ORANGE", "SFR", "BOUYGUES", "SOSH", "FREE", "TELECOM", "TELEPHONE"], "Téléphone"],
  [["NETFLIX", "SPOTIFY", "DISNEY", "CANAL", "PRIME VIDEO", "YOUTUBE", "DEEZER", "APPLE", "OCS", "PARAMOUNT", "HBO"], "Streaming"],
  [["MUTUELLE", "AMELI", "CPAM", "SECURITE SOCIALE"], "Mutuelle"],
  [["AUTOROUTE", "PEAGE", "CONCESSION"], "Péage"],
  [["PARKING", "PARK"], "Parking"],
  [["ASSURANCE"], "Assurance habitation"],
];

function categorizeLabel(label) {
  const text = normalizeLabel(label);
  if (text.includes("ASSURANCE") || /MACIF|MAIF|MAAF|MATMUT|AXA|GENERALI|ALLIANZ|GROUPAMA/.test(text)) {
    if (/HABITATION|MRH|LOGEMENT|MAISON/.test(text)) return "Assurance habitation";
    if (/AUTO|VOITURE|MOTO|SCOOTER/.test(text)) return "Assurance";
    return "Assurance habitation";
  }
  for (const [keywords, category] of CATEGORY_RULES) {
    if (category === "Assurance habitation") continue;
    if (keywords.some((keyword) => text.includes(keyword))) return category;
  }
  return "Autre abonnement";
}

function findCategoryId(db, accountId, name) {
  return db.prepare("SELECT id FROM categories WHERE (account_id IS NULL OR account_id=?) AND name=? ORDER BY account_id IS NULL LIMIT 1").get(accountId, name)?.id ?? null;
}

export function parseCsv(csvText) {
  return parseRows(csvText);
}

export function importCsv(accountId, csvText) {
  const db = getDb();
  const rows = parseRows(csvText);
  const insert = db.prepare("INSERT INTO transactions (account_id, type, amount_cents, description, note, transaction_date) VALUES (@accountId, @type, @amountCents, @description, NULL, @date)");
  const findDuplicate = db.prepare("SELECT id FROM transactions WHERE account_id=? AND transaction_date=? AND amount_cents=? AND LOWER(description)=LOWER(?)");
  const seen = new Set();

  const write = db.transaction(() => {
    for (const row of rows) {
      const description = row.label.length > 180 ? row.label.slice(0, 180) : row.label;
      const key = `${row.date}|${row.amountCents}|${row.type}|${row.label.toLowerCase()}`;
      if (seen.has(key) || findDuplicate.get(accountId, row.date, row.amountCents, description)) continue;
      seen.add(key);
      insert.run({ accountId, type: row.type, amountCents: row.amountCents, description, date: row.date });
    }
  });
  write();

  const recurring = detectRecurring(accountId, rows);
  return {
    lines: rows.length,
    imported: seen.size,
    skipped_duplicates: rows.length - seen.size,
    recurring
  };
}

function detectRecurring(accountId, fileRows) {
  const db = getDb();
  const withdrawals = db.prepare("SELECT transaction_date, amount_cents, description FROM transactions WHERE account_id=? AND type='withdrawal'").all(accountId);
  const groups = new Map();
  for (const row of withdrawals) {
    const label = normalizeLabel(row.description);
    if (!RECURRING_MARKERS.test(label)) continue;
    const base = baseLabel(row.description);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push({ date: row.transaction_date, amount: row.amount_cents, label });
  }

  const created = [];
  const existingNames = new Set(db.prepare("SELECT name FROM recurring_expenses WHERE account_id=?").all(accountId).map((item) => item.name));
  const fallbacks = ["Autre abonnement", "Dépenses diverses"];

  for (const [base, items] of groups) {
    if (items.length < 2) continue;
    items.sort((a, b) => a.date.localeCompare(b.date));
    const deltas = [];
    for (let i = 1; i < items.length; i++) deltas.push((new Date(`${items[i].date}T12:00:00`) - new Date(`${items[i - 1].date}T12:00:00`)) / 86400000);
    const frequency = detectPeriod(deltas);
    if (!frequency) continue;
    const periodDays = PERIODS.find(([name]) => name === frequency)[1];
    const name = base.length > 180 ? base.slice(0, 180) : base;
    if (existingNames.has(name)) continue;
    const amountCents = Math.round(items.reduce((sum, item) => sum + item.amount, 0) / items.length);
    const nextDueDate = addDays(items[items.length - 1].date, periodDays) > todayIso() ? addDays(items[items.length - 1].date, periodDays) : todayIso();
    let categoryId = findCategoryId(db, accountId, categorizeLabel(base));
    for (const fallback of fallbacks) {
      if (categoryId) break;
      categoryId = findCategoryId(db, accountId, fallback);
    }
    if (!categoryId) continue;
    db.prepare("INSERT INTO recurring_expenses (account_id, category_id, name, amount_cents, frequency, interval, next_due_date, active) VALUES (?,?,?,?,?,1,?,1)").run(accountId, categoryId, name, amountCents, frequency, nextDueDate);
    const categoryName = db.prepare("SELECT name FROM categories WHERE id=?").get(categoryId).name;
    created.push({ name, amount_cents: amountCents, frequency, next_due_date: nextDueDate, category_name: categoryName });
    existingNames.add(name);
  }
  return created;
}