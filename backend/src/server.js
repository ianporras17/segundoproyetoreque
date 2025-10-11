import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
  console.log(`[API] listening on http://localhost:${env.PORT}`);
});

const shutdown = (sig) => {
  console.log(`[API] ${sig} -> shutting down`);
  server.close(() => process.exit(0));
};
["SIGINT", "SIGTERM"].forEach(s => process.on(s, () => shutdown(s)));
