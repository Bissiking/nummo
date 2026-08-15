// src/config/env.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number.parseInt(process.env.PORT || "3000", 10);
const kyrosBaseUrl = String(process.env.KYROS_BASE_URL || "").replace(/\/+$/, "");

export const config = Object.freeze({
  projectRoot,
  port,
  nodeEnv: process.env.NODE_ENV || "development",
  databasePath: path.resolve(projectRoot, process.env.DATABASE_PATH || "./data/nummo.sqlite"),
  defaultAccountName: process.env.DEFAULT_ACCOUNT_NAME || "Compte principal",
  authProvider: process.env.AUTH_PROVIDER || "kyros",
  kyrosBaseUrl,
  kyrosAuthorizeUrl: process.env.KYROS_AUTHORIZE_URL || (kyrosBaseUrl ? `${kyrosBaseUrl}/authorize` : ""),
  kyrosTokenUrl: process.env.KYROS_TOKEN_URL || (kyrosBaseUrl ? `${kyrosBaseUrl}/token` : ""),
  kyrosRevokeUrl: process.env.KYROS_REVOKE_URL || (kyrosBaseUrl ? `${kyrosBaseUrl}/revoke` : ""),
  kyrosClientId: process.env.KYROS_CLIENT_ID || "",
  kyrosClientSecret: process.env.KYROS_CLIENT_SECRET || "",
  kyrosJwtSecret: process.env.KYROS_JWT_SECRET || "",
  kyrosIssuer: process.env.KYROS_ISSUER || "kyros",
  kyrosAudience: process.env.KYROS_AUDIENCE || "kyros-modules",
  kyrosResourceAudience: process.env.KYROS_RESOURCE_AUDIENCE || "",
  kyrosRequestedScopes: String(process.env.KYROS_REQUESTED_SCOPE || "profile").split(/\s+/).filter(Boolean),
  kyrosRequiredScopes: String(process.env.KYROS_REQUIRED_SCOPES || "profile").split(/\s+/).filter(Boolean),
  kyrosSsoVersion: process.env.KYROS_SSO_VERSION || "4.4.0",
  kyrosEdition: process.env.KYROS_EDITION || "standard",
  kyrosApplicationScope: process.env.KYROS_APPLICATION_SCOPE || "standard",
  kyrosTimeoutMs: Math.max(1, Number.parseInt(process.env.KYROS_TIMEOUT_SECONDS || "5", 10)) * 1000,
  kyrosCallbackUrl: process.env.KYROS_CALLBACK_URL || `http://localhost:${port}/auth/callback`
});
