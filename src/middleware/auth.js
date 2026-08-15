// src/middleware/auth.js
import { config } from "../config/env.js";
import { kyrosCookies, kyrosIdentity, refreshKyrosTokens, setKyrosTokenCookies, verifyKyrosAccessToken } from "../services/kyros-auth-service.js";
import { AppError } from "../utils/errors.js";

export async function attachIdentity(req, res, next) {
  req.identity = null;
  if (config.authProvider !== "kyros") return next();

  const accessToken = readCookie(req.headers.cookie, kyrosCookies.access);
  let claims = verifyKyrosAccessToken(accessToken);
  const shouldRefresh = req.path.startsWith("/api/") || ["/", "/index", "/index.html"].includes(req.path);
  if (!claims && shouldRefresh) {
    const tokens = await refreshKyrosTokens(readCookie(req.headers.cookie, kyrosCookies.refresh));
    if (tokens) {
      setKyrosTokenCookies(res, tokens);
      claims = tokens.claims;
    }
  }
  req.identity = kyrosIdentity(claims);
  next();
}

export function readCookie(header = "", name) {
  const entry = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return null;
  }
}

export function requireIdentity(req, _res, next) {
  if (!req.identity) return next(new AppError(401, "Authentification requise.", "authentication_required"));
  next();
}

export function requireManager(req, _res, next) {
  if (req.identity?.role !== "manager") return next(new AppError(403, "Cette action est réservée au gestionnaire.", "manager_required"));
  next();
}

export function requirePageIdentity(req, res, next) {
  if (!req.identity) return res.redirect("/login");
  next();
}
