// src/controllers/api-controller.js
import * as accountsRepository from "../repositories/accounts-repository.js";
import * as categoriesService from "../services/categories-service.js";
import * as expensesService from "../services/expenses-service.js";
import * as planningService from "../services/planning-service.js";
import * as projectsService from "../services/projects-service.js";
import * as statisticsService from "../services/statistics-service.js";
import * as transactionsService from "../services/transactions-service.js";
import * as exportService from "../services/export-service.js";
import { getDb } from "../database/db.js";
import { AppError, notFound } from "../utils/errors.js";
import { isoDate, positiveId } from "../utils/validation.js";

export function accountId(req) {
  const id = positiveId(req.params.accountId, "Compte");
  if (!accountsRepository.findAccountForIdentity(id, req.identity)) throw notFound("Compte");
  return id;
}

export const accounts = (req, res) => {
  accountsRepository.ensureAccountForIdentity(req.identity);
  res.json({ data: accountsRepository.listAccountsForIdentity(req.identity) });
};
export const bootstrap = (req, res) => {
  const id = accountId(req);
  res.json({ data: { account: accountsRepository.findAccountForIdentity(id, req.identity), categories: categoriesService.list(id), dashboard: statisticsService.getStatistics(id), budgets: planningService.listBudgets(id), recurring: planningService.listRecurring(id), projects: projectsService.list(id), recent_transactions: transactionsService.list(id, {}).slice(0, 6), recent_expenses: expensesService.list(id, {}).slice(0, 6) } });
};
export const dashboard = (req, res) => res.json({ data: statisticsService.getStatistics(accountId(req)) });
export const vehicle = (req, res) => res.json({ data: statisticsService.getVehicleStatistics(accountId(req)) });
export const comparison = (req, res) => {
  const month = (value) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""))) throw new AppError(400, "Le mois de comparaison est invalide.", "invalid_month");
    return value;
  };
  res.json({ data: statisticsService.getComparison(accountId(req), month(req.query.month_a), month(req.query.month_b)) });
};
export const categoryAnalysis = (req, res) => {
  const period = ["current", "previous", "year", "custom"].includes(req.query.period) ? req.query.period : "current";
  const from = period === "custom" ? isoDate(req.query.from, "La date de début") : null;
  const to = period === "custom" ? isoDate(req.query.to, "La date de fin") : null;
  if (from && to && from > to) throw new AppError(400, "La date de début doit précéder la date de fin.", "invalid_period");
  res.json({ data: statisticsService.getCategoryAnalysis(accountId(req), { period, from, to }) });
};

export const listTransactions = (req, res) => res.json({ data: transactionsService.list(accountId(req), { type: req.query.type, from: req.query.from, to: req.query.to, search: req.query.search }) });
export const createTransaction = (req, res) => res.status(201).json({ data: transactionsService.create(accountId(req), req.body) });
export const updateTransaction = (req, res) => res.json({ data: transactionsService.update(accountId(req), positiveId(req.params.id), req.body) });
export const deleteTransaction = (req, res) => { transactionsService.remove(accountId(req), positiveId(req.params.id)); res.status(204).end(); };

export const listExpenses = (req, res) => res.json({ data: expensesService.list(accountId(req), { categoryId: req.query.category_id ? positiveId(req.query.category_id) : null, from: req.query.from, to: req.query.to, search: req.query.search, vehicle: req.query.vehicle === "1" }) });
export const createExpense = (req, res) => res.status(201).json({ data: expensesService.create(accountId(req), req.body) });
export const updateExpense = (req, res) => res.json({ data: expensesService.update(accountId(req), positiveId(req.params.id), req.body) });
export const deleteExpense = (req, res) => { expensesService.remove(accountId(req), positiveId(req.params.id)); res.status(204).end(); };

export const listCategories = (req, res) => res.json({ data: categoriesService.list(accountId(req)) });
export const createCategory = (req, res) => res.status(201).json({ data: categoriesService.create(accountId(req), req.body) });
export const updateCategory = (req, res) => res.json({ data: categoriesService.update(accountId(req), positiveId(req.params.id), req.body) });
export const deleteCategory = (req, res) => { categoriesService.remove(accountId(req), positiveId(req.params.id)); res.status(204).end(); };

export const listRecurring = (req, res) => res.json({ data: planningService.listRecurring(accountId(req)) });
export const createRecurring = (req, res) => res.status(201).json({ data: planningService.createRecurring(accountId(req), req.body) });
export const updateRecurring = (req, res) => res.json({ data: planningService.updateRecurring(accountId(req), positiveId(req.params.id), req.body) });
export const deleteRecurring = (req, res) => { planningService.deleteRecurring(accountId(req), positiveId(req.params.id)); res.status(204).end(); };
export const listBudgets = (req, res) => res.json({ data: planningService.listBudgets(accountId(req)) });
export const createBudget = (req, res) => res.status(201).json({ data: planningService.createBudget(accountId(req), req.body) });
export const updateBudget = (req, res) => res.json({ data: planningService.updateBudget(accountId(req), positiveId(req.params.id), req.body) });
export const deleteBudget = (req, res) => { planningService.deleteBudget(accountId(req), positiveId(req.params.id)); res.status(204).end(); };
export const calculateProject = (req, res) => res.json({ data: projectsService.calculate(req.body) });
export const listProjects = (req, res) => res.json({ data: projectsService.list(accountId(req)) });
export const createProject = (req, res) => res.status(201).json({ data: projectsService.create(accountId(req), req.body) });
export const contributeProject = (req, res) => res.json({ data: projectsService.contribute(accountId(req), positiveId(req.params.id, "Projet")) });
export const deleteProject = (req, res) => { projectsService.remove(accountId(req), positiveId(req.params.id, "Projet")); res.status(204).end(); };

export const history = (req, res) => {
  const id = accountId(req);
  const amount = (value, label) => {
    if (value === undefined || value === "") return null;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new AppError(400, `${label} invalide.`, "invalid_amount_filter");
    return parsed;
  };
  const from = req.query.from ? isoDate(req.query.from, "La date de début") : null;
  const to = req.query.to ? isoDate(req.query.to, "La date de fin") : null;
  if (from && to && from > to) throw new AppError(400, "La date de début doit précéder la date de fin.", "invalid_period");
  const type = ["deposit", "withdrawal", "expense", "vehicle"].includes(req.query.type) ? req.query.type : null;
  const params = { accountId: id, search: req.query.search ? `%${req.query.search}%` : null, from, to, type, categoryId: req.query.category_id ? positiveId(req.query.category_id, "Catégorie") : null, minAmount: amount(req.query.min_amount_cents, "Montant minimum"), maxAmount: amount(req.query.max_amount_cents, "Montant maximum") };
  if (params.minAmount !== null && params.maxAmount !== null && params.minAmount > params.maxAmount) throw new AppError(400, "Le montant minimum doit être inférieur au maximum.", "invalid_amount_range");
  const rows = getDb().prepare(`SELECT id,'transaction' AS kind,type AS subtype,amount_cents,description,note,transaction_date AS occurred_on,NULL AS category_name FROM transactions WHERE account_id=@accountId AND @categoryId IS NULL AND (@type IS NULL OR type=@type) AND (@search IS NULL OR description LIKE @search OR note LIKE @search) AND (@from IS NULL OR transaction_date>=@from) AND (@to IS NULL OR transaction_date<=@to) AND (@minAmount IS NULL OR amount_cents>=@minAmount) AND (@maxAmount IS NULL OR amount_cents<=@maxAmount) UNION ALL SELECT e.id,'expense' AS kind,e.expense_type AS subtype,e.amount_cents,e.description,e.note,e.expense_date,c.name FROM expenses e JOIN categories c ON c.id=e.category_id LEFT JOIN categories p ON p.id=c.parent_id WHERE e.account_id=@accountId AND (@type IS NULL OR @type='expense' OR (@type='vehicle' AND (c.name='Véhicule' OR p.name='Véhicule'))) AND (@type IS NULL OR @type NOT IN ('deposit','withdrawal')) AND (@categoryId IS NULL OR e.category_id=@categoryId OR c.parent_id=@categoryId) AND (@search IS NULL OR e.description LIKE @search OR e.note LIKE @search OR c.name LIKE @search) AND (@from IS NULL OR e.expense_date>=@from) AND (@to IS NULL OR e.expense_date<=@to) AND (@minAmount IS NULL OR e.amount_cents>=@minAmount) AND (@maxAmount IS NULL OR e.amount_cents<=@maxAmount) ORDER BY occurred_on DESC, id DESC`).all(params);
  res.json({ data: rows });
};

export const exportTransactions = (req, res) => { res.type("text/csv").attachment("transactions-nummo.csv").send(exportService.transactionsCsv(accountId(req))); };
export const exportExpenses = (req, res) => { res.type("text/csv").attachment("depenses-nummo.csv").send(exportService.expensesCsv(accountId(req))); };
