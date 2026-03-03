import express from "express";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import sendMessage from "./api/send-message";
import receiveMessages from "./api/receive-messages";
import ping from "./api/ping";
import getAgents from "./api/get-agents";
import register from "./api/register";
import streamMessages from "./api/stream-messages";
import updateStatus from "./api/update-status";
import { createState } from "./state";
import { ApiEndpoint } from "../agent/types/api-endpoint";

export function createServer(apis?: ApiEndpoint[]) {
  const app = express();
  app.use(express.json());

  app.locals.state = createState();

  app.use(sendMessage);
  app.use(receiveMessages);
  app.use(streamMessages);
  app.use(ping);
  app.use(getAgents);
  app.use(register);
  app.use(updateStatus);

  if (apis) {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "a2a-state-"));
    registerCustomApis(app, apis, stateDir);
  }

  return app;
}

function registerCustomApis(
  app: express.Express,
  apis: ApiEndpoint[],
  stateDir: string,
) {
  for (const api of apis) {
    const method = api.method.toLowerCase() as "get" | "post" | "put" | "delete";

    app[method](api.path, (req, res) => {
      try {
        const env: Record<string, string> = {
          ...process.env as Record<string, string>,
          STATE_DIR: stateDir,
        };

        // Pass query args or body to the handler
        if (req.query.args) {
          env.ARGS = String(req.query.args);
        }
        if (req.body) {
          env.BODY = JSON.stringify(req.body);
        }

        const output = execSync(`bash -c '${api.handler.replace(/'/g, "'\\''")}'`, {
          env,
          timeout: 10000,
          encoding: "utf-8",
        });

        // Try to parse as JSON, fall back to plain text
        try {
          res.json(JSON.parse(output.trim()));
        } catch {
          res.json({ result: output.trim() });
        }
      } catch (err: any) {
        console.error(`[api:${api.name}] Error: ${err.message}`);
        res.status(500).json({ error: `Handler failed: ${err.message}` });
      }
    });

    console.log(`  Registered custom API: ${api.method} ${api.path} (${api.name})`);
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("server.js") ||
    process.argv[1].endsWith("server.ts"))
) {
  const port = parseInt(process.env.PORT || "3000");
  const host = process.env.HOST || "0.0.0.0";

  const app = createServer();
  app.listen(port, host, () => {
    console.log(`a2a-simulator server listening on http://${host}:${port}`);
  });
}
