// src/routes/auth.js
import crypto from "node:crypto";
import { Router } from "express";
import { config } from "../config/env.js";
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

export const authRouter = Router();

authRouter.get("/status", (req, res) => {
  const configured = kyrosAuthConfigured();
  res.json({ data: { provider: config.authProvider, protected: configured, misconfigured: !configured, authenticated: Boolean(req.identity), username: req.identity?.displayName || req.identity?.username || req.identity?.subject || null } });
});

authRouter.get("/kyros", (_req, res, next) => {
  try {
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

authRouter.post("/logout", async (req, res) => {
  await revokeKyrosRefreshToken(readCookie(req.headers.cookie, kyrosCookies.refresh));
  clearKyrosCookies(res);
  res.status(204).end();
});
