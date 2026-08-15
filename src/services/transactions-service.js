// src/services/transactions-service.js
import * as repository from "../repositories/transactions-repository.js";
import { notFound, AppError } from "../utils/errors.js";
import { enumValue, isoDate, optionalText, positiveCents, requiredText } from "../utils/validation.js";

function normalize(input) {
  return {
    type: enumValue(input.type, ["deposit", "withdrawal"], "Type de transaction"),
    amountCents: positiveCents(input.amount_cents ?? input.amountCents),
    description: requiredText(input.description, "La description"),
    note: optionalText(input.note),
    date: isoDate(input.transaction_date ?? input.date, "La date de transaction")
  };
}

function assertFunds(accountId, data, excludeId = null) {
  if (data.type === "withdrawal" && data.amountCents > repository.transactionBalance(accountId, excludeId)) {
    throw new AppError(422, "Ce retrait dépasse le solde disponible.", "insufficient_balance");
  }
}

export function list(accountId, filters) { return repository.listTransactions(accountId, filters); }

export function create(accountId, input) {
  const data = normalize(input);
  assertFunds(accountId, data);
  return repository.insertTransaction({ accountId, ...data });
}

export function update(accountId, id, input) {
  if (!repository.findTransaction(id, accountId)) throw notFound("Transaction");
  const data = normalize(input);
  assertFunds(accountId, data, id);
  return repository.updateTransaction(id, accountId, data);
}

export function remove(accountId, id) {
  const transaction = repository.findTransaction(id, accountId);
  if (!transaction) throw notFound("Transaction");
  try {
    if (!repository.removeTransaction(id, accountId)) throw notFound("Transaction");
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") throw new AppError(409, "Cette transaction est liée à une dépense. Supprimez la dépense associée.", "linked_transaction");
    throw error;
  }
}
