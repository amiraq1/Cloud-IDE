import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { createMockRuntimeController, type RunRequest } from "./runtime.js";

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
  description: "Cloud IDE starter with a socket-driven runtime shell and a mock execution adapter.",
  runner: "mock-stream",
  transport: "socket.io",
  features: [
    "Monaco workspace models",
    "Socket runtime bridge",
    "Interactive stdin stub",
    "Docker adapter seam"
  ]
}));

const runtime = createMockRuntimeController();

const io = new Server(app.server, {
  cors: {
    origin: true
  }
});

io.on("connection", (socket) => {
  const bridge = {
    emitFeed: (payload: { title: string; meta: string; tone: "info" | "success" | "warning" }) => {
      socket.emit("runtime:feed", payload);
    },
    emitLine: (payload: { kind: "stdout" | "stderr" | "system" | "stdin"; text: string }) => {
      socket.emit("runtime:line", payload);
    },
    emitStatus: (payload: { status: "idle" | "queued" | "running"; detail: string }) => {
      socket.emit("runtime:status", payload);
    }
  };

  bridge.emitLine({
    kind: "system",
    text: "runtime bridge attached"
  });
  bridge.emitStatus({
    status: "idle",
    detail: "Sandbox standing by"
  });

  socket.on("runtime:run", (payload: Partial<RunRequest>) => {
    const request: RunRequest = {
      code: payload.code ?? "",
      fileName: payload.fileName ?? "scratch.ts",
      language: payload.language ?? "typescript"
    };

    runtime.run(socket.id, request, bridge);
  });

  socket.on("terminal:input", (payload: { data?: string }) => {
    runtime.receiveInput(socket.id, payload.data ?? "", bridge);
  });

  socket.on("disconnect", () => {
    runtime.disconnect(socket.id);
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
  app.log.error(error);
  process.exit(1);
}
