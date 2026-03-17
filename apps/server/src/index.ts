import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
// import { createMockRuntimeController, type RunRequest } from "./runtime.js";
import { createDockerRuntimeController } from "./docker.js";

interface RunRequest {
  code: string;
  fileName: string;
  language: string;
}

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
      // Direct raw PTY data to the new pty:data event for Xterm.js
      socket.emit("pty:data", { data: payload.text }); 
    },
    emitStatus: (payload: { status: "idle" | "queued" | "running"; detail: string }) => {
      socket.emit("runtime:status", payload);
    }
  };

  bridge.emitLine({
    kind: "system",
    text: "\r\n\x1b[36m❖ Cloud IDE Core attached.\x1b[0m\r\n"
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

    runtime.run(socket.id, request, bridge as any);
  });

  socket.on("terminal:input", (payload: { data?: string }) => {
    runtime.receiveInput(socket.id, payload.data ?? "", bridge as any);
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
  console.error("FATAL ERROR BOOTING SERVER:", error);
  process.exit(1);
}
