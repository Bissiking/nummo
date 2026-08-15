import { getDb } from "../database/db.js";
import { AppError, notFound } from "../utils/errors.js";
import { enumValue, isoDate, positiveCents, positiveId, requiredText } from "../utils/validation.js";

function nonNegativeCents(value, label) {
  const parsed = Number(value || 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new AppError(400, `${label} doit être positif ou nul.`, "invalid_amount");
  return parsed;
}

function positiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new AppError(400, `${label} doit être un nombre entier positif.`, "invalid_number");
  return parsed;
}

function addMonths(dateString, count) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + count);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

function scenario(key, label, monthlyCents, remainingCents, firstDueDate) {
  monthlyCents = Math.min(monthlyCents, remainingCents);
  const months = Math.max(1, Math.ceil(remainingCents / monthlyCents));
  return { key, label, monthly_cents: monthlyCents, months, last_payment_cents: remainingCents - monthlyCents * (months - 1), end_date: addMonths(firstDueDate, months - 1) };
}

function calculationInput(input) {
  const targetCents = positiveCents(input.target_cents, "budget cible");
  const initialCents = nonNegativeCents(input.initial_cents, "Le montant déjà disponible");
  if (initialCents >= targetCents) throw new AppError(400, "Le montant déjà disponible doit rester inférieur au budget cible.", "project_already_funded");
  return {
    targetCents,
    initialCents,
    remainingCents: targetCents - initialCents,
    firstDueDate: isoDate(input.first_due_date, "La première mensualité"),
    mode: enumValue(input.calculation_mode, ["auto", "custom"], "Mode de calcul")
  };
}

export function calculate(input) {
  const data = calculationInput(input);
  if (data.mode === "auto") {
    const reference = positiveCents(input.monthly_cents, "mensualité de référence");
    const choices = [
      scenario("flexible", "Souple", Math.max(1, Math.round(reference * 0.75)), data.remainingCents, data.firstDueDate),
      scenario("balanced", "Équilibrée", reference, data.remainingCents, data.firstDueDate),
      scenario("fast", "Rapide", Math.max(1, Math.round(reference * 1.25)), data.remainingCents, data.firstDueDate)
    ];
    return { ...data, scenarios: choices };
  }

  const scenarios = [];
  if (input.custom_months) {
    const months = positiveInteger(input.custom_months, "La durée personnalisée");
    scenarios.push(scenario("custom-duration", "Durée choisie", Math.ceil(data.remainingCents / months), data.remainingCents, data.firstDueDate));
  }
  if (input.custom_monthly_cents) {
    scenarios.push(scenario("custom-monthly", "Mensualité choisie", positiveCents(input.custom_monthly_cents, "mensualité personnalisée"), data.remainingCents, data.firstDueDate));
  }
  if (!scenarios.length) throw new AppError(400, "Indiquez une durée ou une mensualité personnalisée.", "missing_custom_scenario");
  return { ...data, scenarios };
}

function projectCategoryId(db) {
  const category = db.prepare("SELECT id FROM categories WHERE account_id IS NULL AND name = 'Épargne projet' AND system_category = 1 LIMIT 1").get();
  if (!category) throw new AppError(500, "La catégorie système des projets est indisponible.", "project_category_missing");
  return category.id;
}

export function create(accountId, input) {
  const name = requiredText(input.name, "Le nom du projet");
  const calculation = calculationInput(input);
  const monthlyCents = Math.min(positiveCents(input.monthly_cents, "mensualité retenue"), calculation.remainingCents);
  const contributionMode = enumValue(input.contribution_mode, ["automatic", "manual"], "Mode de progression");
  const scenarioKey = requiredText(input.scenario_key, "La formule", 40);
  const db = getDb();
  return db.transaction(() => {
    const recurringId = db.prepare(`INSERT INTO recurring_expenses (account_id, category_id, name, amount_cents, frequency, interval, next_due_date, active) VALUES (?, ?, ?, ?, 'monthly', 1, ?, 1)`).run(accountId, projectCategoryId(db), `Projet · ${name}`, monthlyCents, calculation.firstDueDate).lastInsertRowid;
    const projectId = db.prepare(`INSERT INTO projects (account_id, recurring_expense_id, name, target_cents, initial_cents, monthly_cents, calculation_mode, contribution_mode, scenario_key, start_date, next_due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(accountId, recurringId, name, calculation.targetCents, calculation.initialCents, monthlyCents, calculation.mode, contributionMode, scenarioKey, calculation.firstDueDate, calculation.firstDueDate).lastInsertRowid;
    return find(projectId, accountId);
  })();
}

function syncAutomatic(accountId) {
  const db = getDb();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const projects = db.prepare("SELECT * FROM projects WHERE account_id = ? AND status = 'active' AND contribution_mode = 'automatic'").all(accountId);
  const sync = db.transaction((project) => {
    let contributed = project.contributed_cents;
    let installments = project.installments_paid;
    let nextDue = project.next_due_date;
    let iterations = 0;
    while (nextDue <= today && project.initial_cents + contributed < project.target_cents && iterations < 1200) {
      const amount = Math.min(project.monthly_cents, project.target_cents - project.initial_cents - contributed);
      const inserted = db.prepare("INSERT OR IGNORE INTO project_contributions (project_id, account_id, amount_cents, due_date, source) VALUES (?, ?, ?, ?, 'automatic')").run(project.id, accountId, amount, nextDue).changes;
      if (inserted) { contributed += amount; installments += 1; }
      nextDue = addMonths(nextDue, 1);
      iterations += 1;
    }
    const completed = project.initial_cents + contributed >= project.target_cents;
    db.prepare("UPDATE projects SET contributed_cents = ?, installments_paid = ?, next_due_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND account_id = ?").run(contributed, installments, nextDue, completed ? "completed" : "active", project.id, accountId);
    if (project.recurring_expense_id) db.prepare("UPDATE recurring_expenses SET next_due_date = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND account_id = ?").run(nextDue, completed ? 0 : 1, project.recurring_expense_id, accountId);
  });
  projects.forEach(sync);
}

function present(project) {
  const trackedCents = Math.min(project.target_cents, project.initial_cents + project.contributed_cents);
  const confirmedContributionsCents = project.contribution_mode === "manual" ? project.contributed_cents : 0;
  const projectedCents = project.contribution_mode === "automatic" ? project.contributed_cents : 0;
  const confirmedSavedCents = Math.min(project.target_cents, project.initial_cents + confirmedContributionsCents);
  const remainingCents = Math.max(0, project.target_cents - trackedCents);
  const remainingInstallments = remainingCents ? Math.ceil(remainingCents / project.monthly_cents) : 0;
  return {
    ...project,
    saved_cents: trackedCents,
    tracked_cents: trackedCents,
    confirmed_saved_cents: confirmedSavedCents,
    confirmed_contributions_cents: confirmedContributionsCents,
    projected_cents: projectedCents,
    remaining_cents: remainingCents,
    progress_percent: Math.min(100, Math.round(trackedCents / project.target_cents * 100)),
    remaining_installments: remainingInstallments,
    estimated_end_date: remainingInstallments ? addMonths(project.next_due_date, remainingInstallments - 1) : project.next_due_date
  };
}

export function list(accountId) {
  syncAutomatic(accountId);
  return getDb().prepare(`SELECT p.*, r.active AS recurring_active FROM projects p LEFT JOIN recurring_expenses r ON r.id = p.recurring_expense_id WHERE p.account_id = ? ORDER BY p.status = 'completed', p.created_at DESC`).all(accountId).map(present);
}

export function find(id, accountId) {
  const row = getDb().prepare("SELECT * FROM projects WHERE id = ? AND account_id = ?").get(id, accountId);
  return row ? present(row) : null;
}

export function contribute(accountId, id) {
  const db = getDb();
  return db.transaction(() => {
    const project = db.prepare("SELECT * FROM projects WHERE id = ? AND account_id = ?").get(id, accountId);
    if (!project) throw notFound("Projet");
    if (project.status === "completed") throw new AppError(409, "Ce projet est déjà entièrement financé.", "project_completed");
    if (project.contribution_mode !== "manual") throw new AppError(409, "Ce projet utilise une progression automatique.", "project_automatic_tracking");
    const amount = Math.min(project.monthly_cents, project.target_cents - project.initial_cents - project.contributed_cents);
    db.prepare("INSERT OR REPLACE INTO project_contributions (project_id, account_id, amount_cents, due_date, source) VALUES (?, ?, ?, ?, 'manual')").run(project.id, accountId, amount, project.next_due_date);
    const contributed = project.contributed_cents + amount;
    const installments = project.installments_paid + 1;
    const nextDue = addMonths(project.next_due_date, 1);
    const completed = project.initial_cents + contributed >= project.target_cents;
    db.prepare("UPDATE projects SET contributed_cents = ?, installments_paid = ?, next_due_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND account_id = ?").run(contributed, installments, nextDue, completed ? "completed" : "active", id, accountId);
    if (project.recurring_expense_id) db.prepare("UPDATE recurring_expenses SET next_due_date = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND account_id = ?").run(nextDue, completed ? 0 : 1, project.recurring_expense_id, accountId);
    return find(id, accountId);
  })();
}

export function remove(accountId, id) {
  const db = getDb();
  return db.transaction(() => {
    const project = db.prepare("SELECT recurring_expense_id FROM projects WHERE id = ? AND account_id = ?").get(id, accountId);
    if (!project) throw notFound("Projet");
    db.prepare("DELETE FROM projects WHERE id = ? AND account_id = ?").run(id, accountId);
    if (project.recurring_expense_id) db.prepare("DELETE FROM recurring_expenses WHERE id = ? AND account_id = ?").run(project.recurring_expense_id, accountId);
  })();
}
