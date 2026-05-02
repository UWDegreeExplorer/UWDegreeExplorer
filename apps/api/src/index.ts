import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Try multiple possible paths to .env
const envPaths = [
  path.resolve(__dirname, "../../../.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../../../.env"),
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

import app from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env["PORT"]) || 5000;

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Deployment trigger: 2026-05-02 12:48 (UTC)
