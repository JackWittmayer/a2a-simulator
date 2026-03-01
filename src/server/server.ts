import express from "express";
import sendMessage from "./api/send-message";
import receiveMessages from "./api/receive-messages";
import ping from "./api/ping";
import getAgents from "./api/get-agents";

export function createServer() {
  const app = express();
  app.use(express.json());

  app.use(sendMessage);
  app.use(receiveMessages);
  app.use(ping);
  app.use(getAgents);

  return app;
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
