// src/services/advice-service.js
import { getDb } from "../database/db.js";
import * as repository from "../repositories/income-sources-repository.js";
import { AppError, notFound } from "../utils/errors.js";
import { requiredText } from "../utils/validation.js";

const LOISIRS = "Loisirs";
const MONTHLY_RATES = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, semiannual: 1 / 6, annual: 1 / 12 };

function monthStart(date = new Date()) { return `${date.toISOString().slice(0, 7)}-01`; }

function sourceData(accountId, input) {
  return { accountId, description: requiredText(input.description, "La description de la source") };
}

export function listIncomeSources(accountId) { return repository.listIncomeSources(accountId); }
export function createIncomeSource(accountId, input) {
  try {
    return repository.saveIncomeSource(sourceData(accountId, input));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") throw new AppError(409, "Cette source de revenu existe déjà.", "income_source_exists");
    throw error;
  }
}
export function updateIncomeSource(accountId, id, input) {
  if (!repository.findIncomeSource(id, accountId)) throw notFound("Source de revenu");
  try {
    return repository.saveIncomeSource(sourceData(accountId, input), id);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") throw new AppError(409, "Cette source de revenu existe déjà.", "income_source_exists");
    throw error;
  }
}
export function deleteIncomeSource(accountId, id) {
  if (!repository.deleteIncomeSource(id, accountId)) throw notFound("Source de revenu");
}

export function getAdvice(accountId, windowMonths = 6) {
  const db = getDb();
  const sources = listIncomeSources(accountId).map((item) => item.description);
  const income = { sources, average_month_cents: null, months: 0, unknown: sources.length === 0 };
  if (sources.length > 0) {
    const clauses = sources.map((_, index) => `LOWER(t.description) LIKE @keyword${index}`).join(" OR ");
    const params = { accountId, offset: `-${windowMonths - 1} months` };
    sources.forEach((source, index) => { params[`keyword${index}`] = `%${source.toLowerCase()}%`; });
    const row = db.prepare(`SELECT COUNT(DISTINCT strftime('%Y-%m', t.transaction_date)) AS months, COALESCE(SUM(t.amount_cents), 0) AS total FROM transactions t WHERE t.account_id=@accountId AND t.type='deposit' AND t.transaction_date>=date('now','start of month',@offset) AND (${clauses})`).get(params);
    income.months = row.months;
    income.unknown = row.months === 0;
    income.average_month_cents = row.months ? Math.round(row.total / row.months) : null;
  }

  const recurring = db.prepare(`SELECT r.amount_cents, r.frequency, r.interval FROM recurring_expenses r LEFT JOIN projects p ON p.recurring_expense_id=r.id WHERE r.account_id=? AND r.active=1 AND p.id IS NULL`).all(accountId);
  const fixedMonthCents = Math.round(recurring.reduce((sum, item) => sum + item.amount_cents * (item.frequency === "custom" ? 1 / Math.max(1, item.interval) : MONTHLY_RATES[item.frequency]), 0));

  const expensesByMonth = (excluded) => db.prepare(`SELECT COUNT(DISTINCT strftime('%Y-%m', e.expense_date)) AS months, COALESCE(SUM(e.amount_cents), 0) AS total FROM expenses e JOIN categories c ON c.id=e.category_id LEFT JOIN categories p ON p.id=c.parent_id WHERE e.account_id=@accountId AND e.expense_type='VARIABLE' AND e.expense_date>=date('now','start of month',@offset) ${excluded ? `AND NOT (c.name=@loisirs OR p.name=@loisirs)` : `AND (c.name=@loisirs OR p.name=@loisirs)`}`).get({ accountId, offset: `-${windowMonths - 1} months`, loisirs: LOISIRS });

  const essentialRow = expensesByMonth(true);
  const essentialMonthCents = essentialRow.months ? Math.round(essentialRow.total / essentialRow.months) : 0;

  const loisirsRow = expensesByMonth(false);
  const pleasureAverageMonthCents = loisirsRow.months ? Math.round(loisirsRow.total / loisirsRow.months) : 0;

  const pleasureMonthCents = db.prepare(`SELECT COALESCE(SUM(e.amount_cents), 0) AS value FROM expenses e JOIN categories c ON c.id=e.category_id LEFT JOIN categories p ON p.id=c.parent_id WHERE e.account_id=@accountId AND (c.name=@loisirs OR p.name=@loisirs) AND strftime('%Y-%m', e.expense_date)=strftime('%Y-%m', 'now')`).get({ accountId, loisirs: LOISIRS }).value;

  const savingsMonthCents = db.prepare(`SELECT COALESCE(SUM(monthly_cents), 0) AS value FROM projects WHERE account_id=? AND status='active'`).get(accountId).value;

  const pleasureBudgetCents = income.average_month_cents == null ? null : income.average_month_cents - fixedMonthCents - essentialMonthCents - savingsMonthCents;
  const marginCents = pleasureBudgetCents == null ? null : pleasureBudgetCents - pleasureAverageMonthCents;
  let status = "unknown";
  if (pleasureBudgetCents != null) {
    if (pleasureBudgetCents < 0) status = "negative";
    else if (marginCents < 0) status = "over";
    else if (pleasureAverageMonthCents > 0 && marginCents / pleasureAverageMonthCents < 0.3) status = "tight";
    else status = "comfortable";
  }

  return {
    window_months: windowMonths,
    income,
    fixed_month_cents: fixedMonthCents,
    essential_month_cents: essentialMonthCents,
    savings_month_cents: savingsMonthCents,
    pleasure_budget_cents: pleasureBudgetCents,
    pleasure_spent_month_cents: pleasureMonthCents,
    pleasure_average_month_cents: pleasureAverageMonthCents,
    margin_cents: marginCents,
    status,
    generated_for: monthStart()
  };
}