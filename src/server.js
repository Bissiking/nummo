// src/server.js
import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { closeDatabase, initializeDatabase } from "./database/db.js";

initializeDatabase();
const server = createApp().listen(config.port, () => {
  console.log(`Nummo est disponible sur http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => { closeDatabase(); process.exit(0); });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
