import { spawn } from "node-pty";
import * as os from "os";
import Docker from "dockerode";
import { RuntimeBridge, RunRequest } from "./runtime.js";

// Define the interface that index.ts expects
export interface RuntimeController {
  disconnect: (connectionId: string) => void | Promise<void>;
  receiveInput: (connectionId: string, data: string, bridge: RuntimeBridge) => void;
  run: (connectionId: string, request: RunRequest, bridge: RuntimeBridge) => void | Promise<void>;
}

const docker = new Docker();
const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

interface ActiveSession {
  ptyProcess: any;
  containerId?: string;
  isShuttingDown: boolean;
}

export function createDockerRuntimeController(): RuntimeController {
  const sessions = new Map<string, ActiveSession>();

  async function disconnect(connectionId: string) {
    const session = sessions.get(connectionId);
    if (!session) return;

    session.isShuttingDown = true;

    try {
      if (session.ptyProcess) {
        session.ptyProcess.kill();
      }
      if (session.containerId) {
        const container = docker.getContainer(session.containerId);
        await container.kill().catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      }
    } catch (err) {
      console.error("Cleanup error:", err);
    } finally {
      sessions.delete(connectionId);
    }
  }

  function receiveInput(connectionId: string, data: string, bridge: RuntimeBridge) {
    const session = sessions.get(connectionId);
    if (session && session.ptyProcess) {
       session.ptyProcess.write(data);
    }
  }

  async function run(connectionId: string, request: RunRequest, bridge: RuntimeBridge) {
    // 1. Cleanup old session if exists
    await disconnect(connectionId);
    
    bridge.emitStatus({ status: "queued", detail: "Allocating ephemeral workspace container..." });
    bridge.emitFeed({
      title: "Booting execution environment",
      meta: `Starting ${request.language} using Docker backend`,
      tone: "info"
    });

    const isNode = request.language === "typescript" || request.language === "javascript";
    const image = isNode ? "node:18-alpine" : "python:3.9-alpine";
    
    try {
      bridge.emitStatus({ status: "running", detail: "Spawning pseudo-terminal..." });
      
      // We encode the user code inside base64 to pass it into the container shell flawlessly
      const base64Code = Buffer.from(request.code).toString('base64');
      const filename = request.fileName || (isNode ? "main.ts" : "scratch.py");
      
      // For typescript execution in node container, we cheat by using tsx or pure node if JS
      let execCmd = "";
      if (request.language === "typescript") {
        execCmd = `npx tsx ${filename}`;
      } else if (request.language === "javascript") {
        execCmd = `node ${filename}`;
      } else if (request.language === "python") {
        execCmd = `python ${filename}`;
      } else {
        execCmd = `cat ${filename}`;
      }

      // The container command base64 decodes the code to a file, then executes it, then gives user a shell
      const containerCmd = [
        "sh", 
        "-c", 
        `echo $USER_CODE | base64 -d > ${filename} && ${execCmd}; echo ""; echo "\\033[32m[Execution finished]\\033[0m"; /bin/sh`
      ];

      // Boot docker container in background and attach PTY to it via node-pty
      const ptyProcess = spawn("docker", [
        "run",
        "-e", `USER_CODE=${base64Code}`,
        "-it",
        "--rm",
        "--name", `cloud-ide-run-${connectionId}`,
        image,
        ...containerCmd
      ], {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
        env: process.env as any
      });

      const session: ActiveSession = {
        ptyProcess,
        containerId: `cloud-ide-run-${connectionId}`, // Using name as ID for easier lookup
        isShuttingDown: false
      };

      sessions.set(connectionId, session);

      ptyProcess.onData((data) => {
         // Emit straight PTY output for Xterm.js
         bridge.emitLine({ kind: "stdout", text: data }); // We cheat the interface, our modified index.ts handles raw pty
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        if (!session.isShuttingDown) {
          bridge.emitStatus({ status: "idle", detail: `Process exited with code ${exitCode}` });
        }
        sessions.delete(connectionId);
      });

      bridge.emitStatus({ status: "running", detail: "Container attached" });

    } catch (err) {
      bridge.emitLine({ kind: "stderr", text: "Failed to spawn Docker environment: " + String(err) });
      bridge.emitStatus({ status: "idle", detail: "Boot failure" });
    }
  }

  return { disconnect, receiveInput, run };
}
