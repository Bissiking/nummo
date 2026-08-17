// src/routes/api.js
import { Router } from "express";
import * as controller from "../controllers/api-controller.js";
import { asyncHandler } from "../middleware/errors.js";
import { requireIdentity, requireManager } from "../middleware/auth.js";

const route = (handler) => asyncHandler(handler);
export const apiRouter = Router();
apiRouter.use(requireIdentity);
apiRouter.get("/accounts", route(controller.accounts));
apiRouter.get("/accounts/:accountId/bootstrap", route(controller.bootstrap));
apiRouter.get("/accounts/:accountId/dashboard", route(controller.dashboard));
apiRouter.get("/accounts/:accountId/stats", route(controller.dashboard));
apiRouter.get("/accounts/:accountId/vehicle", route(controller.vehicle));
apiRouter.get("/accounts/:accountId/comparison", route(controller.comparison));
apiRouter.get("/accounts/:accountId/category-analysis", route(controller.categoryAnalysis));
apiRouter.get("/accounts/:accountId/advice", route(controller.advice));
apiRouter.get("/accounts/:accountId/history", route(controller.history));

function crud(path, handlers) {
  apiRouter.get(path, route(handlers[0]));
  apiRouter.post(path, requireManager, route(handlers[1]));
  apiRouter.put(`${path}/:id`, requireManager, route(handlers[2]));
  apiRouter.delete(`${path}/:id`, requireManager, route(handlers[3]));
}
crud("/accounts/:accountId/transactions", [controller.listTransactions, controller.createTransaction, controller.updateTransaction, controller.deleteTransaction]);
crud("/accounts/:accountId/expenses", [controller.listExpenses, controller.createExpense, controller.updateExpense, controller.deleteExpense]);
crud("/accounts/:accountId/categories", [controller.listCategories, controller.createCategory, controller.updateCategory, controller.deleteCategory]);
crud("/accounts/:accountId/recurring-expenses", [controller.listRecurring, controller.createRecurring, controller.updateRecurring, controller.deleteRecurring]);
crud("/accounts/:accountId/budgets", [controller.listBudgets, controller.createBudget, controller.updateBudget, controller.deleteBudget]);
crud("/accounts/:accountId/income-sources", [controller.listIncomeSources, controller.createIncomeSource, controller.updateIncomeSource, controller.deleteIncomeSource]);
apiRouter.post("/projects/calculate", requireManager, route(controller.calculateProject));
apiRouter.get("/accounts/:accountId/projects", route(controller.listProjects));
apiRouter.post("/accounts/:accountId/projects", requireManager, route(controller.createProject));
apiRouter.post("/accounts/:accountId/projects/:id/contributions", requireManager, route(controller.contributeProject));
apiRouter.delete("/accounts/:accountId/projects/:id", requireManager, route(controller.deleteProject));
apiRouter.get("/accounts/:accountId/export/transactions.csv", route(controller.exportTransactions));
apiRouter.get("/accounts/:accountId/export/expenses.csv", route(controller.exportExpenses));
apiRouter.post("/accounts/:accountId/import", requireManager, route(controller.importCsv));
