// src/services/local-auth-service.js
import crypto from "node:crypto";
import { config } from "../config/env.js";

const sessionDurationSeconds = 12 * 60 * 60;

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signature(payload) {
  return crypto.createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
}

export function localAuthEnabled() {
  return config.authProvider === "local" && Boolean(config.localAuthPassword && config.sessionSecret.length >= 32);
}

export function localAuthRequested() { return config.authProvider === "local" && Boolean(config.localAuthPassword); }

export function authenticateLocal(username, password) {
  if (!localAuthEnabled()) return false;
  const usernameMatches = safeEqual(username, config.localAuthUsername);
  const passwordMatches = safeEqual(password, config.localAuthPassword);
  return usernameMatches && passwordMatches;
}

export function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({ sub: "local-manager", role: "manager", exp: Math.floor(Date.now() / 1000) + sessionDurationSeconds })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || !config.sessionSecret) return null;
  const [payload, receivedSignature] = String(token).split(".");
  if (!payload || !receivedSignature || !safeEqual(receivedSignature, signature(payload))) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return { provider: "local", subject: claims.sub, role: claims.role };
  } catch {
    return null;
  }
}
