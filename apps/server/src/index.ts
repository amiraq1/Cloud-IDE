import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import type { RuntimeBridge, RunRequest } from "./runtime.js";
import { createDockerRuntimeController } from "./docker.js";

const app = Fastify({
  logger: false
});

await app.register(cors, {
  origin: true
});

app.get("/api/health", async () => ({
  ok: true
}));

app.get("/api/session", async () => ({
  projectName: "Basalt Control Room",
  description: "Cloud IDE starter with Docker execution adapter.",
  runner: "docker-pty",
  transport: "socket.io",
  features: [
    "Monaco workspace models",
    "Socket runtime bridge",
    "Interactive stdin stub",
    "Docker adapter seam"
  ]
}));

const runtime = createDockerRuntimeController();

function formatTerminalLine(payload: { kind: "stdout" | "stderr" | "system" | "stdin"; text: string; raw?: boolean }) {
  if (payload.raw) {
    return payload.text;
  }

  let prefix = "";

  switch (payload.kind) {
    case "system":
      prefix = "\x1b[34m[sys]\x1b[0m ";
      break;
    case "stderr":
      prefix = "\x1b[31;1m[err]\x1b[0m ";
      break;
    case "stdin":
      prefix = "\x1b[35m[in]\x1b[0m ";
      break;
    case "stdout":
    default:
      prefix = "\x1b[32m[out]\x1b[0m ";
      break;
  }

  return `${prefix}${payload.text}${/[\r\n]$/.test(payload.text) ? "" : "\r\n"}`;
}

const io = new Server(app.server, {
  cors: {
    origin: true
  }
});

io.on("connection", (socket) => {
  const bridge: RuntimeBridge = {
    emitFeed: (payload) => {
      socket.emit("runtime:feed", payload);
    },
    emitLine: (payload) => {
      socket.emit("pty:data", { data: formatTerminalLine(payload) });
    },
    emitStatus: (payload) => {
      socket.emit("runtime:status", payload);
    }
  };

  bridge.emitLine({
    kind: "system",
    text: "\r\n\x1b[36m* Cloud IDE Core attached.\x1b[0m\r\n",
    raw: true
  });
  bridge.emitStatus({
    status: "idle",
    detail: "تم الاتصال: Sandbox جاهز"
  });

  socket.on("runtime:run", (payload: Partial<RunRequest>) => {
    const request: RunRequest = {
      code: payload.code ?? "",
      fileName: payload.fileName ?? "scratch.ts",
      language: payload.language ?? "typescript"
    };

    Promise.resolve(runtime.run(socket.id, request, bridge)).catch((error) => {
      bridge.emitLine({
        kind: "stderr",
        text: `Runner failure: ${error instanceof Error ? error.message : String(error)}`
      });
      bridge.emitStatus({ status: "idle", detail: "Runner failed" });
    });
  });

  socket.on("terminal:input", (payload: { data?: string }) => {
    runtime.receiveInput(socket.id, payload.data ?? "", bridge);
  });

  socket.on("disconnect", () => {
    void Promise.resolve(runtime.disconnect(socket.id));
  });
});

const port = Number(process.env.PORT ?? 8787);

try {
  await app.listen({
    host: "0.0.0.0",
    port
  });

  console.log(`cloud-ide server listening on http://localhost:${port}`);
} catch (error) {
  console.error("FATAL ERROR BOOTING SERVER:", error);
  process.exit(1);
}
