// tests/api.test.js
import fs from "node:fs";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { closeDatabase, initializeDatabase } from "../src/database/db.js";
import * as accountsRepository from "../src/repositories/accounts-repository.js";
import * as planningService from "../src/services/planning-service.js";
import * as projectsService from "../src/services/projects-service.js";

let app;
let agent;
let directory;
let accountId;

const KYROS_JWT_SECRET = "jwt-test-secret";

function kyrosToken(sub, ttlSeconds = 3600) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "kyros",
    aud: "kyros-modules",
    resource_aud: "kyros:sso:nummo",
    sub,
    client_id: "cli_test",
    scope: "profile",
    username: sub,
    display_name: sub,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", KYROS_JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

before(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "nummo-test-"));
  initializeDatabase(path.join(directory, "test.sqlite"));
  app = createApp();
  agent = request.agent(app).set("Cookie", `nummo_kyros_access=${encodeURIComponent(kyrosToken("usr_test"))}`);
});

after(() => {
  closeDatabase();
  fs.rmSync(directory, { recursive: true, force: true });
});

test("la base crée un compte et les catégories système", async () => {
  const response = await agent.get("/api/accounts").expect(200);
  assert.equal(response.body.data.length, 1);
  accountId = response.body.data[0].id;
  const bootstrap = await agent.get(`/api/accounts/${accountId}/bootstrap`).expect(200);
  assert.ok(bootstrap.body.data.categories.length > 40);
  assert.equal(bootstrap.body.data.dashboard.balance_cents, 0);
});

test("la page de connexion présente l'accès Kyros", async () => {
  const page = await agent.get("/login").expect(200);
  assert.match(page.text, /Ouvrir le registre/);
  const status = await agent.get("/api/auth/status").expect(200);
  assert.equal(status.body.data.provider, "kyros");
  assert.equal(status.body.data.authenticated, true);
});

test("un retrait supérieur au solde est refusé", async () => {
  const response = await agent.post(`/api/accounts/${accountId}/transactions`).send({ type: "withdrawal", amount_cents: 100, description: "Retrait impossible", transaction_date: "2026-08-15" }).expect(422);
  assert.equal(response.body.error.code, "insufficient_balance");
});

test("une dépense déduite crée puis supprime son retrait lié", async () => {
  await agent.post(`/api/accounts/${accountId}/transactions`).send({ type: "deposit", amount_cents: 50000, description: "Dépôt initial", transaction_date: "2026-08-15" }).expect(201);
  const categories = (await agent.get(`/api/accounts/${accountId}/categories`)).body.data;
  const fuel = categories.find((category) => category.name === "Carburant");
  const created = await agent.post(`/api/accounts/${accountId}/expenses`).send({ category_id: fuel.id, amount_cents: 7234, description: "Carburant", expense_date: "2026-08-15", expense_type: "VARIABLE", deduct_from_balance: true }).expect(201);
  assert.ok(created.body.data.linked_transaction_id);
  let dashboard = await agent.get(`/api/accounts/${accountId}/dashboard`).expect(200);
  assert.equal(dashboard.body.data.balance_cents, 42766);
  await agent.delete(`/api/accounts/${accountId}/expenses/${created.body.data.id}`).expect(204);
  dashboard = await agent.get(`/api/accounts/${accountId}/dashboard`).expect(200);
  assert.equal(dashboard.body.data.balance_cents, 50000);
});

test("les validations refusent les montants nuls et dates impossibles", async () => {
  await agent.post(`/api/accounts/${accountId}/transactions`).send({ type: "deposit", amount_cents: 0, description: "Invalide", transaction_date: "2026-08-15" }).expect(400);
  await agent.post(`/api/accounts/${accountId}/transactions`).send({ type: "deposit", amount_cents: 100, description: "Invalide", transaction_date: "2026-02-31" }).expect(400);
});

test("les exports CSV échappent et livrent les données", async () => {
  const response = await agent.get(`/api/accounts/${accountId}/export/transactions.csv`).expect(200);
  assert.match(response.headers["content-type"], /text\/csv/);
  assert.match(response.text, /Dépôt initial/);
});

test("l'historique filtre les types et les montants", async () => {
  const deposits = await agent.get(`/api/accounts/${accountId}/history?type=deposit&min_amount_cents=50000`).expect(200);
  assert.equal(deposits.body.data.length, 1);
  assert.equal(deposits.body.data[0].subtype, "deposit");
  const expenses = await agent.get(`/api/accounts/${accountId}/history?type=expense`).expect(200);
  assert.equal(expenses.body.data.length, 0);
});

test("les périodes statistiques invalides sont refusées", async () => {
  await agent.get(`/api/accounts/${accountId}/comparison?month_a=2026-13&month_b=2026-08`).expect(400);
  await agent.get(`/api/accounts/${accountId}/category-analysis?period=custom&from=2026-09-01&to=2026-08-01`).expect(400);
});

test("l'adaptateur Kyros valide le handshake et les claims du jeton", () => {
  const source = `
    import crypto from "node:crypto";
    import assert from "node:assert/strict";
    const service = await import("./src/services/kyros-auth-service.js");
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: "kyros", aud: "kyros-modules", resource_aud: "kyros:sso:nummo", sub: "usr_test", client_id: "cli_test", scope: "profile", username: "test", exp: Math.floor(Date.now() / 1000) + 60 })).toString("base64url");
    const signature = crypto.createHmac("sha256", "jwt-test-secret").update(header + "." + payload).digest("base64url");
    assert.equal(service.verifyKyrosAccessToken(header + "." + payload + "." + signature).sub, "usr_test");
    const authorization = service.createAuthorizationRequest();
    const target = new URL(authorization.url);
    assert.equal(target.searchParams.get("redirect_uri"), "http://localhost:3030/auth/callback");
    assert.equal(target.searchParams.get("kyros_sso_version"), "4.4.0");
    process.stdout.write("ok");
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: path.resolve(import.meta.dirname, ".."),
    encoding: "utf8",
    env: {
      ...process.env,
      AUTH_PROVIDER: "kyros",
      KYROS_AUTHORIZE_URL: "http://localhost:3001/authorize",
      KYROS_TOKEN_URL: "http://localhost:3001/token",
      KYROS_CLIENT_ID: "cli_test",
      KYROS_CLIENT_SECRET: "client-test-secret",
      KYROS_JWT_SECRET: "jwt-test-secret",
      KYROS_ISSUER: "kyros",
      KYROS_AUDIENCE: "kyros-modules",
      KYROS_RESOURCE_AUDIENCE: "kyros:sso:nummo",
      KYROS_REQUESTED_SCOPE: "profile",
      KYROS_REQUIRED_SCOPES: "profile",
      KYROS_CALLBACK_URL: "http://localhost:3030/auth/callback"
    }
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "ok");
});

test("l'API transforme une formule projet en récurrence suivie", async () => {
  const calculated = await agent.post("/api/projects/calculate").send({ target_cents: 100000, initial_cents: 10000, monthly_cents: 15000, first_due_date: "2026-09-15", calculation_mode: "auto" }).expect(200);
  const selected = calculated.body.data.scenarios.find((item) => item.key === "balanced");
  const created = await agent.post(`/api/accounts/${accountId}/projects`).send({ name: "Nouveau canapé", target_cents: 100000, initial_cents: 10000, monthly_cents: selected.monthly_cents, first_due_date: "2026-09-15", calculation_mode: "auto", contribution_mode: "manual", scenario_key: selected.key }).expect(201);
  assert.equal(created.body.data.remaining_installments, 6);
  const contribution = await agent.post(`/api/accounts/${accountId}/projects/${created.body.data.id}/contributions`).expect(200);
  assert.equal(contribution.body.data.saved_cents, 25000);
  assert.equal(contribution.body.data.confirmed_saved_cents, 25000);
  assert.equal(contribution.body.data.projected_cents, 0);
  const recurring = await agent.get(`/api/accounts/${accountId}/recurring-expenses`).expect(200);
  const linkedRecurring = recurring.body.data.find((item) => item.name === "Projet · Nouveau canapé");
  assert.ok(linkedRecurring);
  assert.equal(linkedRecurring.project_id, created.body.data.id);
  const protectedDeletion = await agent.delete(`/api/accounts/${accountId}/recurring-expenses/${linkedRecurring.id}`).expect(409);
  assert.equal(protectedDeletion.body.error.code, "project_recurring_locked");
  await agent.delete(`/api/accounts/${accountId}/projects/${created.body.data.id}`).expect(204);
  const recurringAfter = await agent.get(`/api/accounts/${accountId}/recurring-expenses`).expect(200);
  assert.ok(!recurringAfter.body.data.some((item) => item.name === "Projet · Nouveau canapé"));
});

test("chaque identité Kyros dispose d'un compte strictement isolé", () => {
  const alice = { provider: "kyros", subject: "usr_alice", username: "alice", displayName: "Alice" };
  const bob = { provider: "kyros", subject: "usr_bob", username: "bob", displayName: "Bob" };
  const aliceAccount = accountsRepository.ensureAccountForIdentity(alice);
  const bobAccount = accountsRepository.ensureAccountForIdentity(bob);
  assert.equal(aliceAccount.name, "Alice");
  assert.equal(bobAccount.name, "Bob");
  assert.notEqual(aliceAccount.id, bobAccount.id);
  assert.deepEqual(accountsRepository.listAccountsForIdentity(alice).map((account) => account.id), [aliceAccount.id]);
  assert.deepEqual(accountsRepository.listAccountsForIdentity(bob).map((account) => account.id), [bobAccount.id]);
  assert.equal(accountsRepository.findAccountForIdentity(bobAccount.id, alice), undefined);
  assert.equal(accountsRepository.findAccountForIdentity(aliceAccount.id, bob), undefined);
});

test("les projets calculent les formules et progressent en manuel ou automatique", () => {
  const automaticScenarios = projectsService.calculate({ target_cents: 120000, initial_cents: 20000, monthly_cents: 20000, first_due_date: "2026-09-15", calculation_mode: "auto" });
  assert.deepEqual(automaticScenarios.scenarios.map((item) => item.key), ["flexible", "balanced", "fast"]);
  assert.deepEqual(automaticScenarios.scenarios.map((item) => item.months), [7, 5, 4]);
  const convergedScenarios = projectsService.calculate({ target_cents: 10000, initial_cents: 0, monthly_cents: 20000, first_due_date: "2026-09-15", calculation_mode: "auto" });
  assert.deepEqual(convergedScenarios.scenarios.map((item) => item.key), ["flexible", "balanced", "fast"]);
  assert.deepEqual(convergedScenarios.scenarios.map((item) => item.monthly_cents), [10000, 10000, 10000]);
  const customScenarios = projectsService.calculate({ target_cents: 120000, initial_cents: 20000, custom_months: 10, custom_monthly_cents: 25000, first_due_date: "2026-09-15", calculation_mode: "custom" });
  assert.equal(customScenarios.scenarios.length, 2);

  const manual = projectsService.create(accountId, { name: "Voyage", target_cents: 120000, initial_cents: 20000, monthly_cents: 20000, first_due_date: "2026-09-15", calculation_mode: "auto", contribution_mode: "manual", scenario_key: "balanced" });
  assert.equal(manual.saved_cents, 20000);
  const paid = projectsService.contribute(accountId, manual.id);
  assert.equal(paid.saved_cents, 40000);
  assert.equal(paid.confirmed_saved_cents, 40000);
  assert.equal(paid.confirmed_contributions_cents, 20000);
  assert.equal(paid.projected_cents, 0);
  assert.equal(paid.installments_paid, 1);

  assert.throws(
    () => planningService.deleteRecurring(accountId, manual.recurring_expense_id),
    (error) => error.code === "project_recurring_locked",
  );
  assert.throws(
    () => planningService.updateRecurring(accountId, manual.recurring_expense_id, {}),
    (error) => error.code === "project_recurring_locked",
  );

  const automatic = projectsService.create(accountId, { name: "Ordinateur", target_cents: 30000, initial_cents: 0, monthly_cents: 10000, first_due_date: "2026-06-15", calculation_mode: "custom", contribution_mode: "automatic", scenario_key: "custom-monthly" });
  const synced = projectsService.list(accountId).find((project) => project.id === automatic.id);
  assert.equal(synced.status, "completed");
  assert.equal(synced.saved_cents, 30000);
  assert.equal(synced.confirmed_saved_cents, 0);
  assert.equal(synced.projected_cents, 30000);
  assert.equal(synced.installments_paid, 3);

  const futureAutomatic = projectsService.create(accountId, { name: "Vélo", target_cents: 50000, initial_cents: 5000, monthly_cents: 10000, first_due_date: "2027-06-15", calculation_mode: "custom", contribution_mode: "automatic", scenario_key: "custom-monthly" });
  assert.throws(
    () => projectsService.contribute(accountId, futureAutomatic.id),
    (error) => error.code === "project_automatic_tracking",
  );
  projectsService.remove(accountId, manual.id);
  projectsService.remove(accountId, automatic.id);
  projectsService.remove(accountId, futureAutomatic.id);
});
