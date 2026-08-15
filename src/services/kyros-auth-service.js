import crypto from "node:crypto";
import { config } from "../config/env.js";
import { AppError } from "../utils/errors.js";

export const kyrosCookies = Object.freeze({ access: "nummo_kyros_access", refresh: "nummo_kyros_refresh", state: "nummo_kyros_state" });
const refreshRequests = new Map();

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function handshake() {
  return {
    kyros_sso_version: config.kyrosSsoVersion,
    kyros_edition: config.kyrosEdition,
    kyros_application_scope: config.kyrosApplicationScope
  };
}

function tokenRequest(body) {
  return fetch(config.kyrosTokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: config.kyrosClientId, client_secret: config.kyrosClientSecret, ...handshake(), ...body }),
    signal: AbortSignal.timeout(config.kyrosTimeoutMs)
  });
}

async function parseTokenResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload?.error?.code || payload?.error || "kyros_token_error";
    throw new AppError(502, "Kyros a refusé la connexion.", code);
  }
  const claims = verifyKyrosAccessToken(payload.access_token);
  if (!claims) throw new AppError(502, "Le jeton reçu de Kyros est invalide.", "invalid_kyros_token");
  return { ...payload, claims };
}

export function kyrosAuthConfigured() {
  return config.authProvider === "kyros" && Boolean(
    config.kyrosAuthorizeUrl && config.kyrosTokenUrl && config.kyrosClientId && config.kyrosClientSecret &&
    config.kyrosJwtSecret && config.kyrosIssuer && config.kyrosAudience && config.kyrosResourceAudience && config.kyrosCallbackUrl
  );
}

export function createAuthorizationRequest() {
  if (!kyrosAuthConfigured()) throw new AppError(503, "La configuration Kyros est incomplète.", "kyros_auth_misconfigured");
  const state = crypto.randomBytes(32).toString("base64url");
  const target = new URL(config.kyrosAuthorizeUrl);
  target.searchParams.set("client_id", config.kyrosClientId);
  target.searchParams.set("redirect_uri", config.kyrosCallbackUrl);
  target.searchParams.set("scope", config.kyrosRequestedScopes.join(" "));
  target.searchParams.set("state", state);
  Object.entries(handshake()).forEach(([key, value]) => target.searchParams.set(key, value));
  return { state, url: target.toString() };
}

export async function exchangeAuthorizationCode(code) {
  const response = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: config.kyrosCallbackUrl });
  return parseTokenResponse(response);
}

export async function refreshKyrosTokens(refreshToken) {
  if (!kyrosAuthConfigured() || !refreshToken) return null;
  if (refreshRequests.has(refreshToken)) return refreshRequests.get(refreshToken);
  const request = (async () => {
    try {
      const response = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
      return await parseTokenResponse(response);
    } catch {
      return null;
    } finally {
      refreshRequests.delete(refreshToken);
    }
  })();
  refreshRequests.set(refreshToken, request);
  return request;
}

export async function revokeKyrosRefreshToken(refreshToken) {
  if (!kyrosAuthConfigured() || !config.kyrosRevokeUrl || !refreshToken) return;
  await fetch(config.kyrosRevokeUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: config.kyrosClientId, client_secret: config.kyrosClientSecret, refresh_token: refreshToken, ...handshake() }),
    signal: AbortSignal.timeout(config.kyrosTimeoutMs)
  }).catch(() => {});
}

export function verifyKyrosAccessToken(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, receivedSignature] = parts;
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;
    const expectedSignature = crypto.createHmac("sha256", config.kyrosJwtSecret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
    if (!safeEqual(receivedSignature, expectedSignature)) return null;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const scopes = new Set(String(claims.scope || "").split(/\s+/).filter(Boolean));
    if (claims.iss !== config.kyrosIssuer || !audiences.includes(config.kyrosAudience)) return null;
    if (claims.resource_aud !== config.kyrosResourceAudience || claims.client_id !== config.kyrosClientId) return null;
    if (!claims.sub || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!config.kyrosRequiredScopes.every((scope) => scopes.has(scope))) return null;
    return claims;
  } catch {
    return null;
  }
}

export function kyrosIdentity(claims) {
  if (!claims) return null;
  return {
    provider: "kyros",
    subject: claims.sub,
    username: claims.username || claims.display_name || claims.sub,
    displayName: claims.display_name || claims.username || claims.sub,
    role: "manager"
  };
}

function cookieOptions(maxAge) {
  return { httpOnly: true, sameSite: "lax", secure: config.nodeEnv === "production", path: "/", maxAge };
}

export function setKyrosTokenCookies(res, tokens) {
  res.cookie(kyrosCookies.access, tokens.access_token, cookieOptions(Math.max(60, Number(tokens.expires_in) || 900) * 1000));
  if (tokens.refresh_token) {
    const expiresAt = Date.parse(tokens.refresh_token_expires_at || "");
    const maxAge = Number.isFinite(expiresAt) ? Math.max(60_000, expiresAt - Date.now()) : 30 * 24 * 60 * 60 * 1000;
    res.cookie(kyrosCookies.refresh, tokens.refresh_token, cookieOptions(maxAge));
  }
}

export function clearKyrosCookies(res) {
  const options = { httpOnly: true, sameSite: "lax", secure: config.nodeEnv === "production", path: "/" };
  Object.values(kyrosCookies).forEach((name) => res.clearCookie(name, options));
}
