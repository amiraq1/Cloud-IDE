import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn, type IPty } from "node-pty";
import Docker from "dockerode";
import { RuntimeBridge, RunRequest } from "./runtime.js";

export interface RuntimeController {
  disconnect: (connectionId: string) => void | Promise<void>;
  receiveInput: (connectionId: string, data: string, bridge: RuntimeBridge) => void;
  run: (connectionId: string, request: RunRequest, bridge: RuntimeBridge) => void | Promise<void>;
}

const docker = new Docker();
const WORKSPACE_DIR = "/workspace";
const MAX_RUNTIME_MS = 120_000;

interface ActiveSession {
  ptyProcess: IPty;
  containerName: string;
  workspaceDir: string;
  isShuttingDown: boolean;
  cleanupPromise?: Promise<void>;
  timeoutHandle?: NodeJS.Timeout;
}

interface RuntimeSpec {
  image: string;
  fileName: string;
  command: string[];
}

function sanitizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_.-]/g, "-").replace(/^-+|-+$/g, "") || "session";
}

function normalizeFileName(input: string | undefined, fallback: string) {
  const base = basename((input ?? fallback).replace(/\\/g, "/"));
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+/, "") || fallback;
  return cleaned.slice(0, 80);
}

function getRuntimeSpec(request: RunRequest): RuntimeSpec {
  switch (request.language) {
    case "javascript": {
      const fileName = normalizeFileName(request.fileName, "main.js");
      return {
        image: "node:22-alpine",
        fileName,
        command: ["node", fileName]
      };
    }
    case "typescript": {
      const fileName = normalizeFileName(request.fileName, "main.ts");
      return {
        image: "node:22-alpine",
        fileName,
        command: ["node", "--experimental-strip-types", fileName]
      };
    }
    case "python": {
      const fileName = normalizeFileName(request.fileName, "main.py");
      return {
        image: "python:3.11-alpine",
        fileName,
        command: ["python", fileName]
      };
    }
    case "bash": {
      const fileName = normalizeFileName(request.fileName, "main.sh");
      return {
        image: "bash:5.2-alpine3.19",
        fileName,
        command: ["bash", fileName]
      };
    }
    default:
      throw new Error(`Unsupported runtime language: ${request.language}`);
  }
}

async function removeWorkspaceDir(workspaceDir: string) {
  await rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
}

function clearSessionTimer(session: ActiveSession) {
  if (session.timeoutHandle) {
    clearTimeout(session.timeoutHandle);
    session.timeoutHandle = undefined;
  }
}

async function releaseSession(session: ActiveSession, options: { killPty: boolean; removeContainer: boolean }) {
  if (session.cleanupPromise) {
    return session.cleanupPromise;
  }

  session.cleanupPromise = (async () => {
    clearSessionTimer(session);

    try {
      if (options.killPty) {
        try {
          session.ptyProcess.kill();
        } catch {
          // Ignore PTY shutdown errors during cleanup.
        }
      }

      if (options.removeContainer) {
        const container = docker.getContainer(session.containerName);
        await container.kill().catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      }
    } finally {
      await removeWorkspaceDir(session.workspaceDir);
    }
  })();

  return session.cleanupPromise;
}

export function createDockerRuntimeController(): RuntimeController {
  const sessions = new Map<string, ActiveSession>();

  async function disconnect(connectionId: string) {
    const session = sessions.get(connectionId);
    if (!session) return;

    session.isShuttingDown = true;
    sessions.delete(connectionId);

    await releaseSession(session, { killPty: true, removeContainer: true }).catch((error) => {
      console.error("Cleanup error:", error);
    });
  }

  function receiveInput(connectionId: string, data: string, _bridge: RuntimeBridge) {
    const session = sessions.get(connectionId);
    if (session && !session.isShuttingDown) {
      session.ptyProcess.write(data);
    }
  }

  async function run(connectionId: string, request: RunRequest, bridge: RuntimeBridge) {
    await disconnect(connectionId);

    const runtimeSpec = getRuntimeSpec(request);
    const workspaceDir = await mkdtemp(join(tmpdir(), "cloud-ide-"));
    const workspaceFile = join(workspaceDir, runtimeSpec.fileName);
    const containerName = `cloud-ide-run-${sanitizeToken(connectionId)}-${Date.now()}`;

    bridge.emitStatus({ status: "queued", detail: "Allocating ephemeral workspace container..." });
    bridge.emitFeed({
      title: "Booting execution environment",
      meta: `Starting ${request.language} using Docker backend`,
      tone: "info"
    });

    try {
      await writeFile(workspaceFile, request.code, "utf8");

      bridge.emitStatus({ status: "running", detail: "Spawning pseudo-terminal..." });

      const ptyProcess = spawn(
        "docker",
        [
          "run",
          "--interactive",
          "--tty",
          "--rm",
          "--read-only",
          "--network",
          "none",
          "--memory",
          "256m",
          "--cpus",
          "1",
          "--pids-limit",
          "128",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          "--tmpfs",
          "/tmp:size=64m,exec",
          "--name",
          containerName,
          "--workdir",
          WORKSPACE_DIR,
          "--volume",
          `${workspaceDir}:${WORKSPACE_DIR}`,
          runtimeSpec.image,
          ...runtimeSpec.command
        ],
        {
          name: "xterm-color",
          cols: 80,
          rows: 24,
          cwd: process.cwd(),
          env: process.env as NodeJS.ProcessEnv
        }
      );

      const session: ActiveSession = {
        ptyProcess,
        containerName,
        workspaceDir,
        isShuttingDown: false
      };

      session.timeoutHandle = setTimeout(() => {
        if (session.isShuttingDown) {
          return;
        }

        bridge.emitLine({
          kind: "stderr",
          text: `Execution exceeded ${MAX_RUNTIME_MS / 1000}s and was terminated.`
        });
        bridge.emitFeed({
          title: "Runtime limit reached",
          meta: "The container was stopped after hitting the execution timeout.",
          tone: "warning"
        });
        bridge.emitStatus({ status: "idle", detail: "Execution timed out" });
        void Promise.resolve(disconnect(connectionId));
      }, MAX_RUNTIME_MS);

      sessions.set(connectionId, session);

      ptyProcess.onData((data) => {
        bridge.emitLine({ kind: "stdout", text: data, raw: true });
      });

      ptyProcess.onExit(({ exitCode }) => {
        const activeSession = sessions.get(connectionId);
        if (activeSession === session) {
          sessions.delete(connectionId);
        }

        if (!session.isShuttingDown) {
          bridge.emitStatus({ status: "idle", detail: `Process exited with code ${exitCode}` });
        }

        void releaseSession(session, { killPty: false, removeContainer: false });
      });

      bridge.emitStatus({ status: "running", detail: "Container attached" });
    } catch (error) {
      await removeWorkspaceDir(workspaceDir);
      bridge.emitLine({
        kind: "stderr",
        text: `Failed to spawn Docker environment: ${String(error)}`
      });
      bridge.emitStatus({ status: "idle", detail: "Boot failure" });
    }
  }

  return { disconnect, receiveInput, run };
}
