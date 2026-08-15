// src/app.js
import path from "node:path";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import { config } from "./config/env.js";
import { attachIdentity, requirePageIdentity } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { apiRouter } from "./routes/api.js";
import { authRouter } from "./routes/auth.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: { directives: { "script-src": ["'self'"], "style-src": ["'self'"], "img-src": ["'self'", "data:"] } } }));
  app.use(compression());
  app.use(express.json({ limit: "64kb" }));
  app.use(attachIdentity);
  app.get("/health", (_req, res) => res.json({ status: "ok", app: "nummo" }));
  app.use("/auth", authRouter);
  app.use("/api/auth", authRouter);
  app.use("/api", apiRouter);
  app.use("/fonts", express.static(path.join(config.projectRoot, "node_modules/@fontsource-variable/sora/files"), { immutable: true, maxAge: "1y" }));
  app.get("/login", (_req, res) => res.sendFile(path.join(config.projectRoot, "public/login.html")));
  app.get("/index.html", requirePageIdentity, (_req, res) => res.sendFile(path.join(config.projectRoot, "public/index.html")));
  app.use(express.static(path.join(config.projectRoot, "public"), { index: false }));
  app.get("*", requirePageIdentity, (req, res, next) => req.accepts("html") ? res.sendFile(path.join(config.projectRoot, "public/index.html")) : next());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
