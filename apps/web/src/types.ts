export interface SessionBootstrap {
  projectName: string;
  description: string;
  runner: string;
  transport: string;
  features: string[];
}

export interface RuntimeStatusEvent {
  status: "idle" | "queued" | "running";
  detail: string;
}

export interface RuntimeLineEvent {
  kind: "stdout" | "stderr" | "system" | "stdin";
  text: string;
}

export interface RuntimeFeedEvent {
  title: string;
  meta: string;
  tone: "info" | "success" | "warning";
}

export interface WorkspaceFile {
  id: string;
  label: string;
  path: string;
  language: "typescript" | "javascript" | "python" | "json" | "bash";
  summary: string;
  accent: "copper" | "signal" | "stone";
  content: string;
}
