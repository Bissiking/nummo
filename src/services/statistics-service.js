// src/services/statistics-service.js
import { getDb } from "../database/db.js";

function scalar(sql, params = {}) { return getDb().prepare(sql).get(params)?.value || 0; }
function monthStart(date = new Date()) { return `${date.toISOString().slice(0, 7)}-01`; }

function monthlyAverage(accountId, months) {
  if (months === "all") {
    const row = getDb().prepare(`SELECT COALESCE(SUM(amount_cents),0) AS total, MAX(1, COUNT(DISTINCT strftime('%Y-%m',expense_date))) AS months FROM expenses WHERE account_id=?`).get(accountId);
    return Math.round(row.total / row.months);
  }
  const total = scalar(`SELECT COALESCE(SUM(amount_cents),0) AS value FROM expenses WHERE account_id=@accountId AND expense_date >= date('now','start of month',@offset)`, { accountId, offset: `-${months - 1} months` });
  return Math.round(total / months);
}

export function getStatistics(accountId) {
  const db = getDb();
  const totals = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount_cents ELSE 0 END),0) AS deposits, COALESCE(SUM(CASE WHEN type='withdrawal' THEN amount_cents ELSE 0 END),0) AS withdrawals FROM transactions WHERE account_id=?`).get(accountId);
  const expensesMonth = scalar(`SELECT COALESCE(SUM(amount_cents),0) AS value FROM expenses WHERE account_id=@accountId AND strftime('%Y-%m',expense_date)=strftime('%Y-%m','now')`, { accountId });
  const previousMonth = scalar(`SELECT COALESCE(SUM(amount_cents),0) AS value FROM expenses WHERE account_id=@accountId AND strftime('%Y-%m',expense_date)=strftime('%Y-%m','now','-1 month')`, { accountId });
  const expensesYear = scalar(`SELECT COALESCE(SUM(amount_cents),0) AS value FROM expenses WHERE account_id=@accountId AND strftime('%Y',expense_date)=strftime('%Y','now')`, { accountId });
  const fixedMonth = scalar(`SELECT COALESCE(SUM(amount_cents),0) AS value FROM expenses WHERE account_id=@accountId AND expense_type='FIXED' AND strftime('%Y-%m',expense_date)=strftime('%Y-%m','now')`, { accountId });
  const vehicleMonth = scalar(`SELECT COALESCE(SUM(e.amount_cents),0) AS value FROM expenses e JOIN categories c ON c.id=e.category_id LEFT JOIN categories p ON p.id=c.parent_id WHERE e.account_id=@accountId AND (c.name='Véhicule' OR p.name='Véhicule') AND strftime('%Y-%m',e.expense_date)=strftime('%Y-%m','now')`, { accountId });
  const vehicleYear = scalar(`SELECT COALESCE(SUM(e.amount_cents),0) AS value FROM expenses e JOIN categories c ON c.id=e.category_id LEFT JOIN categories p ON p.id=c.parent_id WHERE e.account_id=@accountId AND (c.name='Véhicule' OR p.name='Véhicule') AND strftime('%Y',e.expense_date)=strftime('%Y','now')`, { accountId });
  const categoryBreakdown = db.prepare(`SELECT COALESCE(p.name,c.name) AS category, SUM(e.amount_cents) AS amount_cents FROM expenses e JOIN categories c ON c.id=e.category_id LEFT JOIN categories p ON p.id=c.parent_id WHERE e.account_id=? AND strftime('%Y-%m',e.expense_date)=strftime('%Y-%m','now') GROUP BY COALESCE(p.id,c.id) ORDER BY amount_cents DESC`).all(accountId);
  const monthlyTrend = db.prepare(`WITH RECURSIVE months(n,start) AS (SELECT 0,date('now','start of month','-11 months') UNION ALL SELECT n+1,date(start,'+1 month') FROM months WHERE n<11) SELECT strftime('%Y-%m',months.start) AS month, COALESCE(SUM(e.amount_cents),0) AS amount_cents FROM months LEFT JOIN expenses e ON e.account_id=@accountId AND strftime('%Y-%m',e.expense_date)=strftime('%Y-%m',months.start) GROUP BY months.start ORDER BY months.start`).all({ accountId });
  const recurringPlanned = scalar(`SELECT COALESCE(SUM(amount_cents),0) AS value FROM recurring_expenses WHERE account_id=@accountId AND active=1 AND strftime('%Y-%m',next_due_date)=strftime('%Y-%m','now')`, { accountId });
  const recurringPaid = scalar(`SELECT COALESCE(SUM(amount_cents),0) AS value FROM expenses WHERE account_id=@accountId AND is_recurring=1 AND strftime('%Y-%m',expense_date)=strftime('%Y-%m','now')`, { accountId });
  const recurringRemaining = Math.max(0, recurringPlanned - recurringPaid);
  const day = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const paceProjection = Math.round(expensesMonth / Math.max(1, day) * daysInMonth);
  return {
    balance_cents: totals.deposits - totals.withdrawals,
    deposits_cents: totals.deposits,
    withdrawals_cents: totals.withdrawals,
    expenses_month_cents: expensesMonth,
    expenses_year_cents: expensesYear,
    previous_month_cents: previousMonth,
    month_change_percent: previousMonth ? Math.round(((expensesMonth - previousMonth) / previousMonth) * 1000) / 10 : null,
    averages: { months_3_cents: monthlyAverage(accountId, 3), months_6_cents: monthlyAverage(accountId, 6), months_12_cents: monthlyAverage(accountId, 12), all_time_cents: monthlyAverage(accountId, "all") },
    fixed_month_cents: fixedMonth,
    variable_month_cents: expensesMonth - fixedMonth,
    vehicle: { month_cents: vehicleMonth, year_cents: vehicleYear, average_month_cents: monthlyAverageForCategory(accountId, "Véhicule") },
    recurring: { planned_cents: recurringPlanned, paid_cents: recurringPaid, remaining_cents: recurringRemaining },
    projection_cents: Math.max(expensesMonth + recurringRemaining, paceProjection),
    category_breakdown: categoryBreakdown,
    monthly_trend: monthlyTrend,
    generated_for: monthStart()
  };
}

function monthlyAverageForCategory(accountId, parentName) {
  const row = getDb().prepare(`SELECT COALESCE(SUM(e.amount_cents),0) AS total, MAX(1,COUNT(DISTINCT strftime('%Y-%m',e.expense_date))) AS months FROM expenses e JOIN categories c ON c.id=e.category_id LEFT JOIN categories p ON p.id=c.parent_id WHERE e.account_id=? AND (c.name=? OR p.name=?)`).get(accountId, parentName, parentName);
  return Math.round(row.total / row.months);
}

export function getVehicleStatistics(accountId) {
  const summary = getStatistics(accountId).vehicle;
  const byCategory = getDb().prepare(`SELECT c.name AS category, SUM(e.amount_cents) AS amount_cents FROM expenses e JOIN categories c ON c.id=e.category_id LEFT JOIN categories p ON p.id=c.parent_id WHERE e.account_id=? AND (c.name='Véhicule' OR p.name='Véhicule') AND strftime('%Y',e.expense_date)=strftime('%Y','now') GROUP BY c.id ORDER BY amount_cents DESC`).all(accountId);
  const fuel = getDb().prepare(`SELECT COALESCE(SUM(e.amount_cents),0) AS year_cents, COALESCE(SUM(e.fuel_liters),0) AS liters, CASE WHEN SUM(e.fuel_liters)>0 THEN SUM(e.amount_cents)/100.0/SUM(e.fuel_liters) ELSE NULL END AS average_price_per_liter FROM expenses e JOIN categories c ON c.id=e.category_id WHERE e.account_id=? AND c.name='Carburant' AND strftime('%Y',e.expense_date)=strftime('%Y','now')`).get(accountId);
  return { ...summary, by_category: byCategory, fuel };
}

export function getComparison(accountId, monthA, monthB) {
  const rows = getDb().prepare(`SELECT COALESCE(p.name,c.name) AS category, SUM(CASE WHEN strftime('%Y-%m',e.expense_date)=@monthA THEN e.amount_cents ELSE 0 END) AS month_a_cents, SUM(CASE WHEN strftime('%Y-%m',e.expense_date)=@monthB THEN e.amount_cents ELSE 0 END) AS month_b_cents FROM expenses e JOIN categories c ON c.id=e.category_id LEFT JOIN categories p ON p.id=c.parent_id WHERE e.account_id=@accountId AND strftime('%Y-%m',e.expense_date) IN (@monthA,@monthB) GROUP BY COALESCE(p.id,c.id) ORDER BY category`).all({ accountId, monthA, monthB });
  const totalA = rows.reduce((sum, row) => sum + row.month_a_cents, 0);
  const totalB = rows.reduce((sum, row) => sum + row.month_b_cents, 0);
  return { month_a: monthA, month_b: monthB, rows, total_a_cents: totalA, total_b_cents: totalB, change_percent: totalA ? Math.round(((totalB - totalA) / totalA) * 1000) / 10 : null };
}

export function getCategoryAnalysis(accountId, { period = "current", from, to } = {}) {
  const clauses = {
    current: "strftime('%Y-%m',e.expense_date)=strftime('%Y-%m','now')",
    previous: "strftime('%Y-%m',e.expense_date)=strftime('%Y-%m','now','-1 month')",
    year: "strftime('%Y',e.expense_date)=strftime('%Y','now')",
    custom: "e.expense_date BETWEEN @from AND @to"
  };
  const condition = clauses[period] || clauses.current;
  return getDb().prepare(`SELECT COALESCE(p.name,c.name) AS category, SUM(e.amount_cents) AS amount_cents FROM expenses e JOIN categories c ON c.id=e.category_id LEFT JOIN categories p ON p.id=c.parent_id WHERE e.account_id=@accountId AND ${condition} GROUP BY COALESCE(p.id,c.id) ORDER BY amount_cents DESC`).all({ accountId, from: from || "0000-01-01", to: to || "9999-12-31" });
}
