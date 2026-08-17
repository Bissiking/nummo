// public/js/app.js
const state = {
  accountId: null,
  account: null,
  categories: [],
  dashboard: null,
  budgets: [],
  recurring: [],
  projects: [],
  incomeSources: [],
  advice: null,
  projectDraft: null,
  transactions: [],
  expenses: [],
};
const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});
const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthName = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});
const frequencyLabels = {
  weekly: "Chaque semaine",
  monthly: "Chaque mois",
  quarterly: "Chaque trimestre",
  semiannual: "Chaque semestre",
  annual: "Chaque année",
  custom: "Intervalle personnalisé",
};
const pageTitles = {
  dashboard: greeting(),
  history: "Historique",
  expenses: "Dépenses",
  vehicle: "Véhicule",
  budgets: "Budgets",
  projects: "Projets",
  recurring: "Récurrents",
  import: "Importer",
  conseil: "Conseil",
  statistics: "Statistiques",
  settings: "Paramètres",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (cents = 0) => euro.format(cents / 100);
const dateLabel = (value) =>
  value ? shortDate.format(new Date(`${value}T12:00:00`)) : "—";
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ],
  );
const centsFromInput = (value) =>
  Math.round(
    Number.parseFloat(String(value).replace(/\s/g, "").replace(",", ".")) * 100,
  );
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...options.headers },
    ...options,
  });
  const isJson = response.headers.get("content-type")?.includes("json");
  const payload = isJson ? await response.json() : null;
  if (!response.ok)
    throw new Error(payload?.error?.message || "La requête n'a pas abouti.");
  return payload?.data;
}

async function initialize() {
  try {
    const accounts = await api("/api/accounts");
    if (!accounts.length)
      throw new Error("Aucun compte Nummo n'est disponible.");
    state.accountId = accounts[0].id;
    const data = await api(`/api/accounts/${state.accountId}/bootstrap`);
    Object.assign(state, {
      account: data.account,
      categories: data.categories,
      dashboard: data.dashboard,
      budgets: data.budgets,
      recurring: data.recurring,
      projects: data.projects,
      incomeSources: data.income_sources,
      transactions: data.recent_transactions,
      expenses: data.recent_expenses,
    });
    hydrateGlobal();
    renderDashboard();
    configureForms();
    configureAuth();
    route();
  } catch (error) {
    showError(error.message);
  } finally {
    $("#loading").hidden = true;
  }
}

function hydrateGlobal() {
  $("#account-name").textContent = state.account.name;
  $("#today").textContent = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  $("#month-label").textContent = monthName.format(new Date());
  $("#export-transactions").href =
    `/api/accounts/${state.accountId}/export/transactions.csv`;
  $("#export-expenses").href =
    `/api/accounts/${state.accountId}/export/expenses.csv`;
  fillCategorySelects();
}

function renderDashboard() {
  const stats = state.dashboard;
  setText("balance", money(stats.balance_cents));
  setText("deposits", money(stats.deposits_cents));
  setText("withdrawals", money(stats.withdrawals_cents));
  setText("month-expenses", money(stats.expenses_month_cents));
  setText("projection", `≈ ${money(stats.projection_cents)}`);
  setText("avg-3", money(stats.averages.months_3_cents));
  setText("avg-6", money(stats.averages.months_6_cents));
  setText("avg-12", money(stats.averages.months_12_cents));
  setText("avg-all", money(stats.averages.all_time_cents));
  setText("recurring-planned", money(stats.recurring.planned_cents));
  setText("recurring-paid", money(stats.recurring.paid_cents));
  setText("recurring-remaining", money(stats.recurring.remaining_cents));
  setText("year-expenses", money(stats.expenses_year_cents));
  setText("fixed-month", money(stats.fixed_month_cents));
  setText("variable-month", money(stats.variable_month_cents));
  setText(
    "month-change",
    stats.month_change_percent == null
      ? "Pas de référence"
      : `${stats.month_change_percent > 0 ? "+" : ""}${stats.month_change_percent} %`,
  );
  renderBreakdown($("#category-breakdown"), stats.category_breakdown);
  renderRecent();
  renderChartSummary($("#trend-summary"), stats.monthly_trend.slice(-6));
  renderChartSummary($("#stats-chart-summary"), stats.monthly_trend);
  requestAnimationFrame(() => {
    drawLineChart($("#trend-chart"), stats.monthly_trend);
    drawBarChart($("#stats-chart"), stats.monthly_trend);
  });
}

function renderRecent() {
  const combined = [
    ...state.transactions.map((item) => ({
      ...item,
      kind: "transaction",
      occurred_on: item.transaction_date,
    })),
    ...state.expenses.map((item) => ({
      ...item,
      kind: "expense",
      occurred_on: item.expense_date,
    })),
  ]
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
    .slice(0, 8);
  $("#recent-list").innerHTML = combined.length
    ? combined.map(operationRow).join("")
    : emptyState(
        "Le registre est prêt",
        "Ajoutez un dépôt ou une dépense pour commencer.",
      );
}

function operationRow(item, withActions = false) {
  const isDeposit = item.kind === "transaction" && item.type === "deposit";
  const kind = item.kind === "expense" ? "expense" : item.type;
  const title = escapeHtml(item.description);
  const meta =
    item.kind === "expense"
      ? escapeHtml(item.parent_category_name || item.category_name || "Dépense")
      : isDeposit
        ? "Dépôt"
        : "Retrait";
  const sign = isDeposit ? "+" : "−";
  const action = withActions
    ? `<div class="operation-actions"><button class="delete-action edit-action" data-edit-kind="${item.kind}" data-id="${item.id}">Modifier</button><button class="delete-action" data-delete-kind="${item.kind}" data-id="${item.id}">Supprimer</button><span class="operation-amount ${isDeposit ? "in" : ""}">${sign} ${money(item.amount_cents)}</span></div>`
    : `<span class="operation-amount ${isDeposit ? "in" : ""}">${sign} ${money(item.amount_cents)}</span>`;
  return `<article class="operation-row"><span class="operation-mark ${kind}">${isDeposit ? "+" : "−"}</span><div class="operation-copy"><b>${title}</b><small>${meta} · ${dateLabel(item.occurred_on)}</small></div>${withActions ? `<span class="data-meta">${item.deduct_from_balance ? "Déduite du solde" : ""}</span>` : ""}${action}</article>`;
}

function renderBreakdown(target, rows = []) {
  const maximum = Math.max(...rows.map((row) => row.amount_cents), 1);
  target.innerHTML = rows.length
    ? rows
        .map(
          (row) =>
            `<div class="breakdown-row"><span>${escapeHtml(row.category)}</span><progress max="${maximum}" value="${row.amount_cents}" aria-label="Part de ${escapeHtml(row.category)}"></progress><b>${money(row.amount_cents)}</b></div>`,
        )
        .join("")
    : emptyState("Aucune dépense ce mois-ci", "La répartition apparaîtra ici.");
}

async function route() {
  const name = location.hash.slice(1) || "dashboard";
  const valid = pageTitles[name] ? name : "dashboard";
  $$(".view").forEach((view) =>
    view.classList.toggle("active", view.dataset.view === valid),
  );
  $$("[data-route]").forEach((link) =>
    link.classList.toggle("active", link.dataset.route === valid),
  );
  $("#page-title").textContent = pageTitles[valid];
  document.title = `${pageTitles[valid]} · Nummo`;
  try {
    if (valid === "history") await loadHistory();
    if (valid === "expenses") await loadExpenses();
    if (valid === "vehicle") await loadVehicle();
    if (valid === "budgets") renderBudgets();
    if (valid === "projects") await loadProjects();
    if (valid === "recurring") renderRecurring();
    if (valid === "conseil") await loadAdvice();
    if (valid === "statistics") {
      requestAnimationFrame(() =>
        drawBarChart($("#stats-chart"), state.dashboard.monthly_trend),
      );
      await analyzeCategories();
    }
    if (valid === "settings") renderCategories();
  } catch (error) {
    showError(error.message);
  }
  $("#main").focus({ preventScroll: true });
}

async function loadHistory(filters = {}) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  );
  const [rows, transactions, expenses] = await Promise.all([
    api(`/api/accounts/${state.accountId}/history?${query}`),
    api(`/api/accounts/${state.accountId}/transactions`),
    api(`/api/accounts/${state.accountId}/expenses`),
  ]);
  state.transactions = transactions;
  state.expenses = expenses;
  $("#history-list").innerHTML = rows.length
    ? rows
        .map((row) => operationRow({ ...row, type: row.subtype }, true))
        .join("")
    : emptyState(
        "Aucun résultat",
        "Modifiez les filtres ou ajoutez une opération.",
      );
  bindRowActions();
}

async function loadExpenses() {
  state.expenses = await api(`/api/accounts/${state.accountId}/expenses`);
  $("#expense-list").innerHTML = state.expenses.length
    ? state.expenses
        .map((item) =>
          operationRow(
            { ...item, kind: "expense", occurred_on: item.expense_date },
            true,
          ),
        )
        .join("")
    : emptyState("Aucune dépense", "Ajoutez votre première dépense suivie.");
  bindRowActions();
}

async function loadVehicle() {
  const [stats, expenses] = await Promise.all([
    api(`/api/accounts/${state.accountId}/vehicle`),
    api(`/api/accounts/${state.accountId}/expenses?vehicle=1`),
  ]);
  setText("vehicle-month", money(stats.month_cents));
  setText("vehicle-year", money(stats.year_cents));
  setText("vehicle-average", money(stats.average_month_cents));
  setText(
    "fuel-average",
    stats.fuel.average_price_per_liter == null
      ? "—"
      : `${stats.fuel.average_price_per_liter.toFixed(3).replace(".", ",")} €/L`,
  );
  renderBreakdown(
    $("#vehicle-categories"),
    stats.by_category.map((item) => ({ ...item, category: item.category })),
  );
  $("#vehicle-expenses").innerHTML = expenses.length
    ? expenses
        .slice(0, 8)
        .map((item) =>
          operationRow({
            ...item,
            kind: "expense",
            occurred_on: item.expense_date,
          }),
        )
        .join("")
    : emptyState(
        "Aucun coût véhicule",
        "Les dépenses de la catégorie Véhicule apparaîtront ici.",
      );
}

function renderBudgets() {
  $("#budget-list").innerHTML = state.budgets.length
    ? state.budgets
        .map((budget) => {
          const percent = Math.round(
            (budget.used_cents / budget.amount_cents) * 100,
          );
          const status =
            percent >= 100 ? "over" : percent >= 80 ? "warning" : "";
          return `<article class="budget-item ${status}"><header><h3>${escapeHtml(budget.parent_category_name || budget.category_name)}</h3><span><button data-edit-kind="budget" data-id="${budget.id}">Modifier</button><button data-delete-kind="budget" data-id="${budget.id}">Supprimer</button></span></header><div class="budget-numbers"><strong>${money(budget.used_cents)}</strong><span>sur ${money(budget.amount_cents)}</span></div><progress class="budget-track" max="100" value="${Math.min(100, percent)}" aria-label="${percent}% du budget utilisé"></progress><small>${percent}% utilisé · ${money(Math.max(0, budget.amount_cents - budget.used_cents))} restant</small></article>`;
        })
        .join("")
    : emptyState(
        "Aucun budget mensuel",
        "Créez un repère pour une catégorie importante.",
      );
  bindRowActions();
}

function renderRecurring() {
  $("#recurring-list").innerHTML = state.recurring.length
    ? state.recurring
        .map((item) => {
          const actions = item.project_id
            ? `<a class="delete-action edit-action" href="#projects">Gérée depuis Projets</a>`
            : `<button class="delete-action edit-action" data-edit-kind="recurring" data-id="${item.id}">Modifier</button><button class="delete-action" data-delete-kind="recurring" data-id="${item.id}">Supprimer</button>`;
          return `<article class="operation-row"><span class="operation-mark expense"><svg><use href="#i-repeat"/></svg></span><div class="operation-copy"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.category_name)} · ${frequencyLabels[item.frequency]} · prochaine le ${dateLabel(item.next_due_date)}</small></div><span class="data-meta">${item.active ? "Active" : "En pause"}</span><div class="operation-actions">${actions}<span class="operation-amount">${money(item.amount_cents)}</span></div></article>`;
        })
        .join("")
    : emptyState(
        "Aucune récurrence",
        "Ajoutez les charges qui reviennent régulièrement.",
      );
  bindRowActions();
}

async function loadAdvice() {
  const [advice, sources] = await Promise.all([
    api(`/api/accounts/${state.accountId}/advice`),
    api(`/api/accounts/${state.accountId}/income-sources`),
  ]);
  state.advice = advice;
  state.incomeSources = sources;
  renderAdvice();
  renderIncomeSources();
}

const adviceStatus = {
  comfortable: { label: "Confortable", detail: "Le conseil laisse une marge confortable." },
  tight: { label: "Serré", detail: "La marge est mince : le plaisir reste proche du plafond conseillé." },
  over: { label: "Au-delà du conseil", detail: "Vos dépenses plaisir dépassent le budget suggéré." },
  negative: { label: "Budget négatif", detail: "Vos charges dépassent vos revenus : il ne reste rien pour le plaisir." },
  unknown: { label: "Revenus inconnus", detail: "Ajoutez vos sources de revenus pour obtenir un conseil." },
};

function renderAdvice() {
  const advice = state.advice;
  if (!advice) return;
  const status = adviceStatus[advice.status] || adviceStatus.unknown;
  const budgetKnown = advice.pleasure_budget_cents != null;
  setText("advice-budget", budgetKnown ? money(advice.pleasure_budget_cents) : "—");
  setText("advice-status", status.detail);
  const incomeKnown = advice.income.average_month_cents != null;
  const incomeEl = $("#advice-income");
  incomeEl.innerHTML = incomeKnown
    ? `${money(advice.income.average_month_cents)}<small>sur ${advice.income.months} mois</small>`
    : "—";
  setText("advice-fixed", money(advice.fixed_month_cents));
  setText("advice-essential", money(advice.essential_month_cents));
  setText("advice-savings", money(advice.savings_month_cents));
  setText("advice-pleasure-month", money(advice.pleasure_spent_month_cents));
  setText("advice-pleasure-average", money(advice.pleasure_average_month_cents));
  setText("advice-margin", advice.margin_cents == null ? "—" : money(advice.margin_cents));
  const card = $("#advice-card");
  card.dataset.status = advice.status;
}

function renderIncomeSources() {
  const sources = state.incomeSources || [];
  $("#income-source-list").innerHTML = sources.length
    ? sources
        .map(
          (source) =>
            `<article class="operation-row"><span class="operation-mark deposit">+</span><div class="operation-copy"><b>${escapeHtml(source.description)}</b><small>Compté comme revenu dans les dépôts.</small></div><div class="operation-actions"><button class="delete-action edit-action" data-edit-kind="income-source" data-id="${source.id}">Modifier</button><button class="delete-action" data-delete-kind="income-source" data-id="${source.id}">Supprimer</button></div></article>`,
        )
        .join("")
    : emptyState(
        "Aucune source de revenu",
        "Ajoutez « Salaire », « IK »… pour calculer votre revenu moyen.",
      );
  bindRowActions();
}

const importFrequencyLabels = {
  weekly: "hebdomadaire",
  monthly: "mensuelle",
  quarterly: "trimestrielle",
  semiannual: "semestrielle",
  annual: "annuelle",
};

async function runImport() {
  const fileInput = $("#import-file");
  const file = fileInput.files?.[0];
  if (!file) return showError("Choisissez d'abord un fichier CSV.");
  const button = $("#import-run");
  button.disabled = true;
  try {
    const csv = await file.text();
    const result = await api(`/api/accounts/${state.accountId}/import`, {
      method: "POST",
      body: JSON.stringify({ csv }),
    });
    renderImportResult(result);
    $("#import-result").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
    await refreshData();
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
  }
}

function renderImportResult(result) {
  const el = $("#import-result");
  el.hidden = false;
  el.innerHTML = `<div class="metric-ribbon">
      <div><span>Opérations importées</span><strong>${result.imported}</strong></div>
      <div><span>Doublons ignorés</span><strong>${result.skipped_duplicates}</strong></div>
      <div><span>Lignes lues</span><strong>${result.lines}</strong></div>
      <div><span>Récurrents créés</span><strong>${result.recurring.length}</strong></div>
    </div>${
      result.recurring.length
        ? `<section class="comparison-section"><div class="section-heading"><h2>Récurrents créés</h2><a href="#recurring">Voir les récurrents</a></div><div class="data-list">${result.recurring
            .map(
              (item) =>
                `<article class="operation-row"><span class="operation-mark expense"><svg><use href="#i-repeat"/></svg></span><div class="operation-copy"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.category_name)} · ${importFrequencyLabels[item.frequency] || item.frequency} · prochaine le ${dateLabel(item.next_due_date)}</small></div><span class="operation-amount">${money(item.amount_cents)}</span></article>`,
            )
            .join("")}</div></section>`
        : ""
    }`;
}

async function loadProjects() {
  state.projects = await api(`/api/accounts/${state.accountId}/projects`);
  renderProjects();
}

function renderProjects() {
  const active = state.projects.filter(
    (project) => project.status === "active",
  );
  setText("projects-active", active.length);
  setText(
    "projects-saved",
    money(
      state.projects.reduce(
        (total, project) => total + project.confirmed_saved_cents,
        0,
      ),
    ),
  );
  setText(
    "projects-projected",
    money(
      state.projects.reduce(
        (total, project) => total + project.projected_cents,
        0,
      ),
    ),
  );
  setText(
    "projects-remaining",
    money(
      active.reduce((total, project) => total + project.remaining_cents, 0),
    ),
  );
  $("#project-list").innerHTML = state.projects.length
    ? state.projects
        .map((project) => {
          const completed = project.status === "completed";
          const automatic = project.contribution_mode === "automatic";
          const confirmedCompleted = completed && !automatic;
          const tracking =
            automatic
              ? `${project.remaining_installments} échéance${project.remaining_installments > 1 ? "s" : ""} · projection automatique`
              : `${project.remaining_installments} échéance${project.remaining_installments > 1 ? "s" : ""} · validation manuelle`;
          const action =
            !completed && !automatic
              ? `<button class="button secondary project-contribute" data-project-id="${project.id}">Mensualité versée</button>`
              : "";
          const headline = automatic
            ? `${money(project.confirmed_saved_cents)} confirmés`
            : `${money(project.confirmed_saved_cents)} confirmés`;
          const amountContext = automatic
            ? `+ ${money(project.projected_cents)} projetés sur ${money(project.target_cents)}`
            : `sur ${money(project.target_cents)}`;
          const progressLabel = automatic
            ? `${project.progress_percent}% du projet prévu`
            : `${project.progress_percent}% du projet financé`;
          const secondMetric = automatic
            ? `<dt>Disponible réel</dt><dd>${money(project.confirmed_saved_cents)}</dd>`
            : `<dt>Versements confirmés</dt><dd>${money(project.confirmed_contributions_cents)}</dd>`;
          const completionLabel = completed
            ? automatic
              ? "Projection terminée"
              : "Objectif atteint"
            : tracking;
          return `<article class="project-item ${confirmedCompleted ? "completed" : ""}"><header><div><h3>${escapeHtml(project.name)}</h3><span>${completionLabel}</span></div><strong>${project.progress_percent}%</strong></header><div class="project-amounts"><b>${headline}</b><span>${amountContext}</span></div><progress max="100" value="${project.progress_percent}" aria-label="${progressLabel}"></progress><dl><div><dt>Mensualité</dt><dd>${money(project.monthly_cents)}</dd></div><div>${secondMetric}</div><div><dt>${automatic ? "Reste projeté" : "Reste"}</dt><dd>${money(project.remaining_cents)}</dd></div><div><dt>Fin estimée</dt><dd>${completed ? "Terminé" : dateLabel(project.estimated_end_date)}</dd></div></dl><footer>${action}<button class="delete-action" data-delete-kind="project" data-id="${project.id}">Supprimer</button></footer></article>`;
        })
        .join("")
    : emptyState(
        "Aucun projet en préparation",
        "Créez un objectif pour comparer plusieurs rythmes mensuels.",
      );
  $$(".project-contribute").forEach(
    (button) => (button.onclick = () => contributeProject(button)),
  );
  bindRowActions();
}

async function contributeProject(button) {
  const project = state.projects.find(
    (item) => item.id === Number(button.dataset.projectId),
  );
  if (!project || !(await confirmProjectContribution(project))) return;
  button.disabled = true;
  try {
    const project = await api(
      `/api/accounts/${state.accountId}/projects/${button.dataset.projectId}/contributions`,
      { method: "POST" },
    );
    toast(
      project.status === "completed"
        ? "Projet entièrement financé."
        : "Mensualité ajoutée au projet.",
    );
    await refreshData();
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
  }
}

function confirmProjectContribution(project) {
  const dialog = $("#project-contribution-dialog");
  $("#project-contribution-message").textContent =
    `Confirmer le versement de ${money(project.monthly_cents)} pour « ${project.name} » ?`;
  return new Promise((resolve) => {
    dialog.returnValue = "";
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm"),
      { once: true },
    );
    dialog.showModal();
  });
}

function renderCategories() {
  const parents = state.categories.filter((item) => !item.parent_id);
  $("#category-list").innerHTML = parents
    .map((parent) => {
      const children = state.categories.filter(
        (item) => item.parent_id === parent.id,
      );
      const parentActions = parent.system_category
        ? ""
        : `<span><button data-edit-kind="category" data-id="${parent.id}">Modifier</button><button data-delete-kind="category" data-id="${parent.id}">Supprimer</button></span>`;
      return `<section class="category-group"><div><h3>${escapeHtml(parent.name)}</h3><small>${parent.type === "FIXED" ? "Fixe" : "Variable"}${parent.system_category ? " · système" : ""}</small>${parentActions}</div><ul>${children.map((child) => `<li>${escapeHtml(child.name)}${child.system_category ? "" : ` <button data-edit-kind="category" data-id="${child.id}">Modifier</button><button data-delete-kind="category" data-id="${child.id}">Supprimer</button>`}</li>`).join("")}</ul></section>`;
    })
    .join("");
  bindRowActions();
}

function fillCategorySelects() {
  const parents = state.categories.filter((item) => !item.parent_id);
  const options = parents
    .map(
      (parent) =>
        `<optgroup label="${escapeHtml(parent.name)}"><option value="${parent.id}">${escapeHtml(parent.name)}</option>${state.categories
          .filter((item) => item.parent_id === parent.id)
          .map(
            (item) =>
              `<option value="${item.id}">${escapeHtml(item.name)}</option>`,
          )
          .join("")}</optgroup>`,
    )
    .join("");
  $$("select[name=category_id]").forEach((select) => {
    select.innerHTML = `${select.dataset.filter ? '<option value="">Toutes catégories</option>' : ""}${options}`;
  });
  const parentOptions = `<option value="">Aucune, catégorie principale</option>${parents.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
  $("#category-dialog select[name=parent_id]").innerHTML = parentOptions;
}

function configureForms() {
  $$("[data-open]").forEach((button) =>
    button.addEventListener("click", () =>
      openDialog(button.dataset.open, { vehicle: button.dataset.vehicle }),
    ),
  );
  $$('dialog button[value="cancel"]').forEach((button) => {
    button.type = "button";
    button.addEventListener("click", () =>
      button.closest("dialog").close("cancel"),
    );
  });
  $$("dialog form[data-form]").forEach((form) =>
    form.addEventListener("submit", submitForm),
  );
  $("#history-filters").addEventListener("submit", (event) => {
    event.preventDefault();
    const filters = Object.fromEntries(new FormData(event.currentTarget));
    if (filters.min_amount)
      filters.min_amount_cents = centsFromInput(filters.min_amount);
    if (filters.max_amount)
      filters.max_amount_cents = centsFromInput(filters.max_amount);
    delete filters.min_amount;
    delete filters.max_amount;
    loadHistory(filters);
  });
  $("#comparison-form").addEventListener("submit", compareMonths);
  $("#category-analysis-form").addEventListener("submit", analyzeCategories);
  const projectForm = $("#project-form");
  projectForm.addEventListener("submit", calculateProject);
  projectForm.addEventListener("input", invalidateProjectDraft);
  projectForm.addEventListener("change", (event) => {
    invalidateProjectDraft();
    if (event.target.name === "calculation_mode")
      updateProjectCalculationMode();
  });
  $("#expense-dialog select[name=category_id]").addEventListener(
    "change",
    updateFuelFields,
  );
  $("#import-file").addEventListener("change", () => {
    const name = $("#import-file").files?.[0]?.name;
    $("#import-file-name").textContent = name || "Choisir un fichier .csv";
  });
  $("#import-run").addEventListener("click", runImport);
  $("#mobile-more").addEventListener("click", () => $("#nav-dialog").show());
  $("[data-close-nav]").addEventListener("click", () =>
    $("#nav-dialog").close(),
  );
  $$("#nav-dialog a").forEach((link) =>
    link.addEventListener("click", () => $("#nav-dialog").close()),
  );
  window.addEventListener("hashchange", route);
  window.addEventListener(
    "resize",
    debounce(() => {
      if (state.dashboard) {
        drawLineChart($("#trend-chart"), state.dashboard.monthly_trend);
        drawBarChart($("#stats-chart"), state.dashboard.monthly_trend);
      }
    }, 120),
  );
}

function configureAuth() {
  $("#sidebar-logout").addEventListener("click", logout);
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
    location.assign("/login");
  } catch (error) {
    showError(error.message);
  }
}

function openDialog(id, options = {}) {
  const dialog = document.getElementById(id);
  const form = $("form", dialog);
  form.reset();
  delete form.dataset.editId;
  $(".form-error", form).textContent = "";
  $$("input[type=date]", form).forEach((input) => (input.value = today()));
  if (options.vehicle) {
    const vehicle = state.categories.find(
      (item) => item.name === "Véhicule" && !item.parent_id,
    );
    if (vehicle) $("select[name=category_id]", form).value = vehicle.id;
  }
  if (id === "project-dialog") {
    invalidateProjectDraft();
    updateProjectCalculationMode();
  }
  updateFuelFields();
  dialog.showModal();
}

async function submitForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitter = event.submitter;
  if (submitter?.value === "cancel") return form.closest("dialog").close();
  const type = form.dataset.form;
  const data = Object.fromEntries(new FormData(form));
  const configs = {
    transaction: {
      path: "transactions",
      body: () => ({ ...data, amount_cents: centsFromInput(data.amount) }),
    },
    expense: {
      path: "expenses",
      body: () => ({
        ...data,
        amount_cents: centsFromInput(data.amount),
        deduct_from_balance: $("[name=deduct_from_balance]", form).checked,
        is_recurring: $("[name=is_recurring]", form).checked,
      }),
    },
    budget: {
      path: "budgets",
      body: () => ({
        category_id: data.category_id,
        amount_cents: centsFromInput(data.amount),
      }),
    },
    recurring: {
      path: "recurring-expenses",
      body: () => ({
        ...data,
        amount_cents: centsFromInput(data.amount),
        active: true,
      }),
    },
    "income-source": { path: "income-sources", body: () => data },
    category: { path: "categories", body: () => data },
  };
  const config = configs[type];
  const button = submitter;
  button.disabled = true;
  try {
    const editId = form.dataset.editId;
    await api(
      `/api/accounts/${state.accountId}/${config.path}${editId ? `/${editId}` : ""}`,
      { method: editId ? "PUT" : "POST", body: JSON.stringify(config.body()) },
    );
    form.closest("dialog").close();
    toast(editId ? "Modification enregistrée." : "Ajout enregistré.");
    await refreshData();
  } catch (error) {
    $(".form-error", form).textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function refreshData() {
  const data = await api(`/api/accounts/${state.accountId}/bootstrap`);
  Object.assign(state, {
    categories: data.categories,
    dashboard: data.dashboard,
    budgets: data.budgets,
    recurring: data.recurring,
    projects: data.projects,
    incomeSources: data.income_sources,
    transactions: data.recent_transactions,
    expenses: data.recent_expenses,
  });
  fillCategorySelects();
  renderDashboard();
  await route();
}

function bindRowActions() {
  $$("[data-delete-kind]").forEach(
    (button) =>
      (button.onclick = () =>
        confirmDelete(button.dataset.deleteKind, button.dataset.id)),
  );
  $$("[data-edit-kind]").forEach(
    (button) =>
      (button.onclick = () =>
        editItem(button.dataset.editKind, button.dataset.id)),
  );
}

async function confirmDelete(kind, id) {
  const dialog = $("#confirm-dialog");
  const collections = {
    transaction: state.transactions,
    expense: state.expenses,
    budget: state.budgets,
    recurring: state.recurring,
    project: state.projects,
    "income-source": state.incomeSources,
    category: state.categories,
  };
  const item = collections[kind]?.find((entry) => entry.id === Number(id));
  const name =
    item?.description || item?.name || item?.category_name || "cet élément";
  const amountText = item?.amount_cents ? ` (${money(item.amount_cents)})` : "";
  const consequence =
    kind === "expense" && item?.linked_transaction_id
      ? " Le retrait lié sera également supprimé et le solde détenu sera recalculé."
      : kind === "project"
        ? " La récurrence liée sera également supprimée."
        : "";
  $("#confirm-message").textContent =
    `Supprimer « ${name} »${amountText} ?${consequence} Cette action est définitive.`;
  const result = await new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm"),
      { once: true },
    );
    dialog.showModal();
  });
  if (!result) return;
  const paths = {
    transaction: "transactions",
    expense: "expenses",
    budget: "budgets",
    recurring: "recurring-expenses",
    project: "projects",
    "income-source": "income-sources",
    category: "categories",
  };
  try {
    await api(`/api/accounts/${state.accountId}/${paths[kind]}/${id}`, {
      method: "DELETE",
    });
    toast("Élément supprimé.");
    await refreshData();
  } catch (error) {
    showError(error.message);
  }
}

function editItem(kind, id) {
  const collections = {
    transaction: state.transactions,
    expense: state.expenses,
    budget: state.budgets,
    recurring: state.recurring,
    "income-source": state.incomeSources,
    category: state.categories,
  };
  const item = collections[kind]?.find((entry) => entry.id === Number(id));
  if (!item) return showError("L'élément à modifier n'est plus disponible.");
  const dialogIds = {
    transaction: "transaction-dialog",
    expense: "expense-dialog",
    budget: "budget-dialog",
    recurring: "recurring-dialog",
    "income-source": "income-source-dialog",
    category: "category-dialog",
  };
  openDialog(dialogIds[kind]);
  const form = $(`#${dialogIds[kind]} form`);
  form.dataset.editId = id;
  const mappings = {
    transaction: {
      type: item.type,
      amount: item.amount_cents / 100,
      description: item.description,
      transaction_date: item.transaction_date,
      note: item.note,
    },
    expense: {
      amount: item.amount_cents / 100,
      expense_date: item.expense_date,
      description: item.description,
      category_id: item.category_id,
      expense_type: item.expense_type,
      payment_method: item.payment_method,
      note: item.note,
      fuel_type: item.fuel_type,
      fuel_liters: item.fuel_liters,
      fuel_price_per_liter: item.fuel_price_per_liter,
      vehicle_mileage: item.vehicle_mileage,
    },
    budget: { category_id: item.category_id, amount: item.amount_cents / 100 },
    recurring: {
      name: item.name,
      amount: item.amount_cents / 100,
      next_due_date: item.next_due_date,
      category_id: item.category_id,
      frequency: item.frequency,
      interval: item.interval,
    },
    "income-source": { description: item.description },
    category: { name: item.name, parent_id: item.parent_id, type: item.type },
  };
  for (const [name, value] of Object.entries(mappings[kind])) {
    const field = form.elements[name];
    if (field && value != null) field.value = value;
  }
  if (kind === "expense") {
    form.elements.deduct_from_balance.checked = Boolean(
      item.deduct_from_balance,
    );
    form.elements.is_recurring.checked = Boolean(item.is_recurring);
    updateFuelFields();
  }
}

function updateFuelFields() {
  const form = $("#expense-dialog form");
  const category = state.categories.find(
    (item) => item.id === Number(form.elements.category_id?.value),
  );
  $("#fuel-fields").hidden = category?.name !== "Carburant";
}

function updateProjectCalculationMode() {
  const form = $("#project-form");
  const custom = form.elements.calculation_mode.value === "custom";
  $("#project-auto-fields").hidden = custom;
  $("#project-custom-fields").hidden = !custom;
  form.elements.monthly_amount.required = !custom;
  invalidateProjectDraft();
}

function invalidateProjectDraft() {
  state.projectDraft = null;
  const scenarios = $("#project-scenarios");
  scenarios.hidden = true;
  scenarios.innerHTML = "";
}

function projectCalculationBody(form) {
  const data = Object.fromEntries(new FormData(form));
  const body = {
    target_cents: centsFromInput(data.target_amount),
    initial_cents: centsFromInput(data.initial_amount || 0),
    first_due_date: data.first_due_date,
    calculation_mode: data.calculation_mode,
  };
  if (data.calculation_mode === "auto")
    body.monthly_cents = centsFromInput(data.monthly_amount);
  if (data.custom_months)
    body.custom_months = Number.parseInt(data.custom_months, 10);
  if (data.custom_monthly_amount)
    body.custom_monthly_cents = centsFromInput(data.custom_monthly_amount);
  return { data, body };
}

async function calculateProject(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button =
    event.submitter || form.querySelector('button[type="submit"]');
  button.disabled = true;
  $(".form-error", form).textContent = "";
  try {
    const input = projectCalculationBody(form);
    const result = await api("/api/projects/calculate", {
      method: "POST",
      body: JSON.stringify(input.body),
    });
    state.projectDraft = { data: input.data, body: input.body, result };
    const scenarios = $("#project-scenarios");
    scenarios.innerHTML = `<p>Choisissez la formule à transformer en récurrence.</p><div>${result.scenarios.map((item) => `<button type="button" class="scenario-option ${item.key === "balanced" ? "recommended" : ""}" data-scenario-key="${item.key}"><span>${escapeHtml(item.label)}</span><strong>${money(item.monthly_cents)}<small>/ mois</small></strong><b>${item.months} mensualité${item.months > 1 ? "s" : ""}</b><em>jusqu’au ${dateLabel(item.end_date)}</em></button>`).join("")}</div>`;
    scenarios.hidden = false;
    $$(".scenario-option", scenarios).forEach(
      (choice) => (choice.onclick = () => activateProject(choice)),
    );
    scenarios.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
  } catch (error) {
    $(".form-error", form).textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function activateProject(button) {
  const draft = state.projectDraft;
  const scenario = draft?.result.scenarios.find(
    (item) => item.key === button.dataset.scenarioKey,
  );
  if (!scenario) return;
  button.disabled = true;
  try {
    await api(`/api/accounts/${state.accountId}/projects`, {
      method: "POST",
      body: JSON.stringify({
        name: draft.data.name,
        target_cents: draft.body.target_cents,
        initial_cents: draft.body.initial_cents,
        monthly_cents: scenario.monthly_cents,
        first_due_date: draft.body.first_due_date,
        calculation_mode: draft.body.calculation_mode,
        contribution_mode: draft.data.contribution_mode,
        scenario_key: scenario.key,
      }),
    });
    $("#project-dialog").close();
    toast(`Projet créé avec la formule ${scenario.label.toLowerCase()}.`);
    await refreshData();
    location.hash = "projects";
  } catch (error) {
    $("#project-form .form-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function compareMonths(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const result = await api(
      `/api/accounts/${state.accountId}/comparison?${new URLSearchParams(data)}`,
    );
    const change =
      result.change_percent == null
        ? "Pas de référence"
        : `${result.change_percent > 0 ? "+" : ""}${result.change_percent} %`;
    $("#comparison-table").innerHTML =
      `<p class="comparison-change">Évolution : <strong>${change}</strong></p><table class="comparison-table"><thead><tr><th>Catégorie</th><th>${escapeHtml(result.month_a)}</th><th>${escapeHtml(result.month_b)}</th></tr></thead><tbody>${result.rows.map((row) => `<tr><td>${escapeHtml(row.category)}</td><td>${money(row.month_a_cents)}</td><td>${money(row.month_b_cents)}</td></tr>`).join("")}<tr><th>Total</th><th>${money(result.total_a_cents)}</th><th>${money(result.total_b_cents)}</th></tr></tbody></table>`;
  } catch (error) {
    showError(error.message);
  }
}

async function analyzeCategories(event) {
  event?.preventDefault();
  const data = Object.fromEntries(
    new FormData(event?.currentTarget || $("#category-analysis-form")),
  );
  try {
    const rows = await api(
      `/api/accounts/${state.accountId}/category-analysis?${new URLSearchParams(data)}`,
    );
    renderBreakdown($("#category-analysis"), rows);
  } catch (error) {
    showError(error.message);
  }
}

function renderChartSummary(target, rows) {
  target.innerHTML = rows
    .map(
      (row) =>
        `<span><b>${escapeHtml(row.month.slice(5))}</b>${money(row.amount_cents)}</span>`,
    )
    .join("");
}

function drawLineChart(canvas, rows) {
  if (!canvas || canvas.offsetParent === null) return;
  const { ctx, width, height, ratio } = canvasContext(canvas);
  const pad = 18 * ratio,
    max = Math.max(...rows.map((row) => row.amount_cents), 1);
  const points = rows.map((row, index) => ({
    x: pad + index * ((width - pad * 2) / Math.max(1, rows.length - 1)),
    y: height - pad - (row.amount_cents / max) * (height - pad * 2),
  }));
  ctx.strokeStyle = "#332f2b";
  ctx.lineWidth = ratio;
  ctx.beginPath();
  ctx.moveTo(pad, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.stroke();
  ctx.strokeStyle = "#d9865b";
  ctx.lineWidth = 2 * ratio;
  ctx.beginPath();
  points.forEach((point, index) =>
    index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
  );
  ctx.stroke();
  ctx.fillStyle = "#f0a276";
  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.7 * ratio, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBarChart(canvas, rows) {
  if (!canvas || canvas.offsetParent === null) return;
  const { ctx, width, height, ratio } = canvasContext(canvas);
  const pad = 34 * ratio;
  const max = Math.max(...rows.map((row) => row.amount_cents), 1);
  const gap = 8 * ratio;
  const barWidth = (width - pad * 2 - gap * (rows.length - 1)) / rows.length;
  ctx.font = `${9 * ratio}px Sora`;
  ctx.textAlign = "center";
  rows.forEach((row, index) => {
    const barHeight = (row.amount_cents / max) * (height - pad * 2);
    const x = pad + index * (barWidth + gap);
    const y = height - pad - barHeight;
    ctx.fillStyle = index === rows.length - 1 ? "#d9865b" : "#332f2b";
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#746e67";
    ctx.fillText(row.month.slice(5), x + barWidth / 2, height - 12 * ratio);
  });
}

function canvasContext(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  return {
    ctx: canvas.getContext("2d"),
    width: canvas.width,
    height: canvas.height,
    ratio,
  };
}
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
function emptyState(title, text) {
  return `<div class="empty-state"><b>${escapeHtml(title)}</b>${escapeHtml(text)}</div>`;
}
function showError(message) {
  const banner = $("#app-error");
  banner.textContent = message;
  banner.hidden = false;
  setTimeout(() => {
    banner.hidden = true;
  }, 6000);
}
function toast(message) {
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  $("#toast-region").append(element);
  setTimeout(() => element.remove(), 3200);
}
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

initialize();
