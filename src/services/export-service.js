// src/services/export-service.js
import * as transactions from "../repositories/transactions-repository.js";
import * as expenses from "../repositories/expenses-repository.js";

function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function build(headers, rows) { return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"); }

export function transactionsCsv(accountId) {
  return build(["id", "type", "montant_centimes", "description", "note", "date"], transactions.listTransactions(accountId).map((row) => [row.id, row.type, row.amount_cents, row.description, row.note, row.transaction_date]));
}

export function expensesCsv(accountId) {
  return build(["id", "catégorie", "sous-catégorie", "montant_centimes", "description", "note", "moyen_paiement", "date", "type", "déduite_solde"], expenses.listExpenses(accountId).map((row) => [row.id, row.parent_category_name || row.category_name, row.parent_category_name ? row.category_name : "", row.amount_cents, row.description, row.note, row.payment_method, row.expense_date, row.expense_type, row.deduct_from_balance]));
}
