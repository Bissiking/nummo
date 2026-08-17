-- src/database/schema.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
  kyros_user_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kyros_user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('manager', 'owner')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, kyros_user_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
  parent_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  type TEXT NOT NULL DEFAULT 'VARIABLE' CHECK(type IN ('FIXED', 'VARIABLE')),
  system_category INTEGER NOT NULL DEFAULT 0 CHECK(system_category IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, parent_id, name)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 180),
  note TEXT CHECK(note IS NULL OR length(note) <= 2000),
  transaction_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 180),
  note TEXT CHECK(note IS NULL OR length(note) <= 2000),
  payment_method TEXT CHECK(payment_method IS NULL OR length(payment_method) <= 80),
  expense_date TEXT NOT NULL,
  expense_type TEXT NOT NULL DEFAULT 'VARIABLE' CHECK(expense_type IN ('FIXED', 'VARIABLE')),
  is_recurring INTEGER NOT NULL DEFAULT 0 CHECK(is_recurring IN (0, 1)),
  deduct_from_balance INTEGER NOT NULL DEFAULT 0 CHECK(deduct_from_balance IN (0, 1)),
  linked_transaction_id INTEGER UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  fuel_type TEXT CHECK(fuel_type IS NULL OR fuel_type IN ('Essence', 'Gasoil', 'E85', 'GPL', 'Électricité', 'Autre')),
  fuel_liters REAL CHECK(fuel_liters IS NULL OR fuel_liters > 0),
  fuel_price_per_liter REAL CHECK(fuel_price_per_liter IS NULL OR fuel_price_per_liter > 0),
  vehicle_mileage INTEGER CHECK(vehicle_mileage IS NULL OR vehicle_mileage >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 180),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'custom')),
  interval INTEGER NOT NULL DEFAULT 1 CHECK(interval > 0),
  next_due_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS income_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 120),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, description)
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  period TEXT NOT NULL DEFAULT 'monthly' CHECK(period = 'monthly'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, category_id, period)
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  recurring_expense_id INTEGER UNIQUE REFERENCES recurring_expenses(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 180),
  target_cents INTEGER NOT NULL CHECK(target_cents > 0),
  initial_cents INTEGER NOT NULL DEFAULT 0 CHECK(initial_cents >= 0),
  monthly_cents INTEGER NOT NULL CHECK(monthly_cents > 0),
  contributed_cents INTEGER NOT NULL DEFAULT 0 CHECK(contributed_cents >= 0),
  installments_paid INTEGER NOT NULL DEFAULT 0 CHECK(installments_paid >= 0),
  calculation_mode TEXT NOT NULL CHECK(calculation_mode IN ('auto', 'custom')),
  contribution_mode TEXT NOT NULL CHECK(contribution_mode IN ('automatic', 'manual')),
  scenario_key TEXT NOT NULL,
  start_date TEXT NOT NULL,
  next_due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  due_date TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('automatic', 'manual')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, due_date)
);

CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_memberships_kyros_user ON account_memberships(kyros_user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_date ON expenses(account_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_recurring_account_due ON recurring_expenses(account_id, next_due_date);
CREATE INDEX IF NOT EXISTS idx_budgets_account ON budgets(account_id);
CREATE INDEX IF NOT EXISTS idx_income_sources_account ON income_sources(account_id);
CREATE INDEX IF NOT EXISTS idx_projects_account_status ON projects(account_id, status);
CREATE INDEX IF NOT EXISTS idx_project_contributions_project ON project_contributions(project_id, due_date);
