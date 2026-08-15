// src/routes/auth.js
import crypto from "node:crypto";
import { Router } from "express";
import { config } from "../config/env.js";
import { authenticateLocal, createSessionToken, localAuthEnabled, localAuthRequested } from "../services/local-auth-service.js";
import {
  clearKyrosCookies,
  createAuthorizationRequest,
  exchangeAuthorizationCode,
  kyrosAuthConfigured,
  kyrosCookies,
  revokeKyrosRefreshToken,
  setKyrosTokenCookies
} from "../services/kyros-auth-service.js";
import { readCookie } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

export const authRouter = Router();

authRouter.get("/status", (req, res) => {
  const kyros = config.authProvider === "kyros";
  const protectedMode = kyros ? kyrosAuthConfigured() : localAuthEnabled();
  const misconfigured = kyros ? !kyrosAuthConfigured() : localAuthRequested() && !localAuthEnabled();
  res.json({ data: { provider: config.authProvider, protected: protectedMode, misconfigured, authenticated: Boolean(req.identity), username: req.identity?.displayName || req.identity?.username || req.identity?.subject || null } });
});

authRouter.get("/kyros", (_req, res, next) => {
  try {
    if (config.authProvider !== "kyros") throw new AppError(400, "La connexion Kyros n'est pas active.", "kyros_auth_disabled");
    const authorization = createAuthorizationRequest();
    res.cookie(kyrosCookies.state, authorization.state, { httpOnly: true, sameSite: "lax", secure: config.nodeEnv === "production", path: "/", maxAge: 10 * 60 * 1000 });
    res.redirect(authorization.url);
  } catch (error) {
    next(error);
  }
});

authRouter.get("/callback", async (req, res) => {
  const expectedState = readCookie(req.headers.cookie, kyrosCookies.state);
  const receivedState = String(req.query.state || "");
  const statesMatch = expectedState && receivedState && expectedState.length === receivedState.length && crypto.timingSafeEqual(Buffer.from(expectedState), Buffer.from(receivedState));
  if (!statesMatch || req.query.error || !req.query.code) return res.redirect("/login?error=kyros_callback_rejected");
  try {
    const tokens = await exchangeAuthorizationCode(String(req.query.code).slice(0, 500));
    setKyrosTokenCookies(res, tokens);
    res.clearCookie(kyrosCookies.state, { httpOnly: true, sameSite: "lax", secure: config.nodeEnv === "production", path: "/" });
    res.redirect("/");
  } catch {
    clearKyrosCookies(res);
    res.redirect("/login?error=kyros_exchange_failed");
  }
});

authRouter.post("/local", (req, res, next) => {
  if (config.authProvider !== "local") return next(new AppError(400, "La connexion locale n'est pas active.", "local_auth_disabled"));
  if (!localAuthRequested()) return res.json({ data: { authenticated: true, mode: "unprotected-local" } });
  if (!localAuthEnabled()) return next(new AppError(503, "SESSION_SECRET doit contenir au moins 32 caractères.", "local_auth_misconfigured"));
  const username = String(req.body.username || "").slice(0, 120);
  const password = String(req.body.password || "").slice(0, 500);
  if (!authenticateLocal(username, password)) return next(new AppError(401, "Identifiant ou mot de passe incorrect.", "invalid_credentials"));
  res.cookie("nummo_session", createSessionToken(), { httpOnly: true, sameSite: "lax", secure: config.nodeEnv === "production", maxAge: 12 * 60 * 60 * 1000, path: "/" });
  res.json({ data: { authenticated: true } });
});

authRouter.post("/logout", async (req, res) => {
  if (config.authProvider === "kyros") {
    await revokeKyrosRefreshToken(readCookie(req.headers.cookie, kyrosCookies.refresh));
    clearKyrosCookies(res);
  }
  res.clearCookie("nummo_session", { httpOnly: true, sameSite: "lax", secure: config.nodeEnv === "production", path: "/" });
  res.status(204).end();
});
