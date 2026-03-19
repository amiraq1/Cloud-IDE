type RuntimeStatus = "idle" | "queued" | "running";
type RuntimeLineKind = "stdout" | "stderr" | "system" | "stdin";
type FeedTone = "info" | "success" | "warning";

export interface RuntimeBridge {
  emitFeed: (payload: { title: string; meta: string; tone: FeedTone }) => void;
  emitLine: (payload: { kind: RuntimeLineKind; text: string; raw?: boolean }) => void;
  emitStatus: (payload: { status: RuntimeStatus; detail: string }) => void;
}

export interface RunRequest {
  code: string;
  fileName: string;
  language: string;
}

interface SessionState {
  awaitingInput: boolean;
  buffer: string;
  timers: NodeJS.Timeout[];
}

interface RuntimeController {
  disconnect: (connectionId: string) => void;
  receiveInput: (connectionId: string, data: string, bridge: RuntimeBridge) => void;
  run: (connectionId: string, request: RunRequest, bridge: RuntimeBridge) => void;
}

function createSession(): SessionState {
  return {
    awaitingInput: false,
    buffer: "",
    timers: []
  };
}

function commandFor(language: string, fileName: string) {
  switch (language) {
    case "python":
      return `python ${fileName}`;
    case "bash":
      return `bash ${fileName}`;
    case "json":
      return `cat ${fileName}`;
    case "javascript":
    case "typescript":
    default:
      return `node ${fileName}`;
  }
}

function extractPreview(code: string, language: string) {
  const jsMatch = code.match(/console\.log\((["'`])([\s\S]*?)\1\)/);
  const pyMatch = code.match(/print\((["'])([\s\S]*?)\1\)/);

  if ((language === "javascript" || language === "typescript") && jsMatch?.[2]) {
    return jsMatch[2].replace(/\$\{.*?\}/g, "[expr]");
  }

  if (language === "python" && pyMatch?.[2]) {
    return pyMatch[2];
  }

  return `executed ${language} capsule with ${code.split(/\r?\n/).length} lines`;
}

function requestsInput(code: string) {
  return /\binput\(|\bprompt\(/.test(code);
}

function clearSession(state: SessionState) {
  for (const timer of state.timers) {
    clearTimeout(timer);
  }

  state.timers = [];
  state.awaitingInput = false;
  state.buffer = "";
}

export function createMockRuntimeController(): RuntimeController {
  const sessions = new Map<string, SessionState>();

  function ensureSession(connectionId: string) {
    const current = sessions.get(connectionId);

    if (current) {
      return current;
    }

    const fresh = createSession();
    sessions.set(connectionId, fresh);
    return fresh;
  }

  function schedule(state: SessionState, delay: number, callback: () => void) {
    const timer = setTimeout(callback, delay);
    state.timers.push(timer);
  }

  return {
    disconnect(connectionId) {
      const state = sessions.get(connectionId);

      if (!state) {
        return;
      }

      clearSession(state);
      sessions.delete(connectionId);
    },

    receiveInput(connectionId, data, bridge) {
      const state = ensureSession(connectionId);

      if (!state.awaitingInput) {
        return;
      }

      const printable = data === "\r" ? "\n" : data;
      state.buffer += printable;

      if (data !== "\r") {
        return;
      }

      const value = state.buffer.trim() || "<empty>";
      bridge.emitLine({ kind: "stdout", text: `stdin captured: ${value}` });
      bridge.emitFeed({
        title: "Interactive response received",
        meta: "The mock runner consumed terminal input and resumed execution.",
        tone: "success"
      });
      bridge.emitStatus({ status: "running", detail: "Finalizing runtime after stdin" });
      state.awaitingInput = false;
      state.buffer = "";

      schedule(state, 280, () => {
        bridge.emitLine({ kind: "stdout", text: "run completed successfully" });
        bridge.emitStatus({ status: "idle", detail: "Sandbox standing by" });
        bridge.emitFeed({
          title: "Run finalized",
          meta: "Execution stream returned to idle state.",
          tone: "success"
        });
        clearSession(state);
      });
    },

    run(connectionId, request, bridge) {
      const state = ensureSession(connectionId);
      const wantsInput = requestsInput(request.code);
      const preview = extractPreview(request.code, request.language);
      const command = commandFor(request.language, request.fileName);

      clearSession(state);

      bridge.emitStatus({ status: "queued", detail: "Allocating ephemeral workspace" });
      bridge.emitFeed({
        title: "Run queued",
        meta: `${request.fileName} scheduled on ${request.language} runtime`,
        tone: "info"
      });
      bridge.emitLine({ kind: "system", text: "> creating workspace capsule" });

      schedule(state, 250, () => {
        bridge.emitStatus({ status: "running", detail: "Booting runtime capsule" });
        bridge.emitLine({ kind: "system", text: `> ${command}` });
      });

      schedule(state, 520, () => {
        bridge.emitLine({ kind: "stdout", text: preview });
      });

      schedule(state, 760, () => {
        if (wantsInput) {
          state.awaitingInput = true;
          bridge.emitLine({ kind: "stdin", text: "stdin> waiting for input, type in terminal and press Enter" });
          bridge.emitFeed({
            title: "Run paused for stdin",
            meta: "Interactive terminal plumbing is active.",
            tone: "warning"
          });
          return;
        }

        bridge.emitLine({ kind: "stdout", text: "run completed successfully" });
        bridge.emitStatus({ status: "idle", detail: "Sandbox standing by" });
        bridge.emitFeed({
          title: "Run finalized",
          meta: "Execution stream returned to idle state.",
          tone: "success"
        });
        clearSession(state);
      });
    }
  };
}

