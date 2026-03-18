import { useState, useEffect, useRef, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CircleDot,
  FolderTree,
  LayoutPanelLeft,
  Play,
  Rocket,
  Search,
  Settings2,
  Share2,
  Sparkles,
  TerminalSquare,
  UsersRound,
  X
} from "lucide-react";
import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import { io, Socket } from "socket.io-client";
import Terminal from "./Terminal";
import FileExplorer from "./FileExplorer";
import EditorTabs from "./EditorTabs";
import Breadcrumb from "./Breadcrumb";
import { useFileSystem, FileNode } from "../store/filesystem";
import { useTabs } from "../store/tabs";

interface WorkspaceProps {
  prompt: string;
  onClose: () => void;
}

const railItems: Array<{ label: string; icon: LucideIcon; active?: boolean }> = [
  { label: "Workspace", icon: LayoutPanelLeft, active: true },
  { label: "Files", icon: FolderTree },
  { label: "Agent", icon: Bot },
  { label: "Runtime", icon: TerminalSquare },
  { label: "Search", icon: Search },
  { label: "Settings", icon: Settings2 }
];

const collaboratorNames = ["Rana", "Omar", "Mina"];

function getRuntimeSocketUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:8787";
  }

  const protocol = window.location.protocol === "https:" ? "https" : "http";
  return `${protocol}://${window.location.hostname}:8787`;
}

function findNode(nodes: FileNode[], id: string): FileNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function countFiles(nodes: FileNode[]): number {
  return nodes.reduce((total, node) => {
    if (node.type === "file") return total + 1;
    return total + countFiles(node.children || []);
  }, 0);
}

export default function Workspace({ prompt, onClose }: WorkspaceProps) {
  const { data, activeFileId, setActiveFile, updateFile } = useFileSystem();
  const { openTabs, activeTabId, openTab, closeTab, closeOtherTabs, closeAllTabs, markDirty } = useTabs();
  const editorRef = useRef<any>(null);

  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [terminalHeight, setTerminalHeight] = useState(220);
  const isResizingSidebar = useRef(false);
  const isResizingTerminal = useRef(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [termStatus, setTermStatus] = useState("connecting");
  const [tabContextMenu, setTabContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  useEffect(() => {
    if (activeTabId && activeTabId !== activeFileId) {
      setActiveFile(activeTabId);
    }
  }, [activeTabId, activeFileId, setActiveFile]);

  const currentFileId = activeTabId || activeFileId;
  const activeFile = currentFileId ? findNode(data, currentFileId) : undefined;
  const fileCount = countFiles(data);

  useEffect(() => {
    let disposed = false;
    const runtimeUrl = getRuntimeSocketUrl();
    const healthController = new AbortController();
    const newSocket = io(runtimeUrl, {
      transports: ["websocket"],
      autoConnect: false
    });
    const connectTimer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`${runtimeUrl}/api/health`, {
            signal: healthController.signal
          });

          if (!response.ok || disposed) {
            return;
          }

          setTermStatus("connecting");
          newSocket.connect();
        } catch (error) {
          if (!disposed && !healthController.signal.aborted) {
            setTermStatus("runtime unavailable");
          }
        }
      })();
    }, 0);

    const handleConnect = () => {
      if (!disposed) {
        setTermStatus("connected");
      }
    };

    const handleDisconnect = () => {
      if (!disposed) {
        setTermStatus("disconnected");
      }
    };

    const handleConnectError = () => {
      if (!disposed) {
        setTermStatus("runtime unavailable");
      }
    };

    const handleRuntimeStatus = (statusPayload: { detail: string }) => {
      if (!disposed) {
        setTermStatus(statusPayload.detail);
      }
    };

    newSocket.on("connect", handleConnect);
    newSocket.on("disconnect", handleDisconnect);
    newSocket.on("connect_error", handleConnectError);
    newSocket.on("runtime:status", handleRuntimeStatus);

    setSocket(newSocket);

    return () => {
      disposed = true;
      healthController.abort();
      window.clearTimeout(connectTimer);
      newSocket.off("connect", handleConnect);
      newSocket.off("disconnect", handleDisconnect);
      newSocket.off("connect_error", handleConnectError);
      newSocket.off("runtime:status", handleRuntimeStatus);

      if (newSocket.connected || newSocket.active) {
        newSocket.disconnect();
      }
    };
  }, []);

  const handleRunFile = () => {
    if (!socket || !socket.connected || !activeFile) return;

    if (activeFile.type === "folder") {
      alert("اختر ملفًا قابلًا للتشغيل أولًا.");
      return;
    }

    socket.emit("runtime:run", {
      code: activeFile.content || "",
      fileName: activeFile.name,
      language: activeFile.language || "typescript"
    });
  };

  const handleFileSelect = (file: FileNode) => {
    if (file.type === "folder") return;

    openTab({
      id: file.id,
      name: file.name,
      language: file.language
    });
  };

  const handleSidebarResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      isResizingSidebar.current = true;
      const startX = event.clientX;
      const startWidth = sidebarWidth;

      const onMove = (moveEvent: MouseEvent) => {
        if (!isResizingSidebar.current) return;
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(240, Math.min(420, startWidth + delta));
        setSidebarWidth(nextWidth);
      };

      const onUp = () => {
        isResizingSidebar.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [sidebarWidth]
  );

  const handleTerminalResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      isResizingTerminal.current = true;
      const startY = event.clientY;
      const startHeight = terminalHeight;

      const onMove = (moveEvent: MouseEvent) => {
        if (!isResizingTerminal.current) return;
        const delta = startY - moveEvent.clientY;
        const nextHeight = Math.max(180, Math.min(360, startHeight + delta));
        setTerminalHeight(nextHeight);
      };

      const onUp = () => {
        isResizingTerminal.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [terminalHeight]
  );

  useEffect(() => {
    if (!tabContextMenu) return;
    const handler = () => setTabContextMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [tabContextMenu]);

  const activityItems = [
    { label: "Prompt parsed", detail: prompt || "No brief", tone: "done" },
    { label: "Workspace files", detail: `${fileCount} files seeded`, tone: "done" },
    {
      label: "Runtime bridge",
      detail: termStatus === "disconnected" ? "Awaiting socket" : termStatus,
      tone: termStatus === "disconnected" ? "queued" : "live"
    },
    { label: "Preview surface", detail: "Ready for deploy checks", tone: "live" }
  ];

  return (
    <div className="workspace-shell">
      <header className="workspace-topbar">
        <div className="workspace-topbar__brand">
          <span className="brand brand--workspace">
            <span className="brand__mark" />
            <span className="brand__text">Cloud IDE</span>
          </span>
          <div className="workspace-topbar__titleblock">
            <strong className="workspace-topbar__title">launchpad-studio</strong>
            <span className="workspace-topbar__subtitle">Agent workspace inspired by Replit</span>
          </div>
        </div>

        <div className="workspace-topbar__modes" aria-label="أنماط العرض">
          <button className="workspace-mode-pill workspace-mode-pill--active" type="button">
            Editor
          </button>
          <button className="workspace-mode-pill" type="button">
            Preview
          </button>
          <button className="workspace-mode-pill" type="button">
            Deploy
          </button>
        </div>

        <div className="workspace-topbar__actions">
          <button className="workspace-action" type="button">
            <Share2 size={16} />
            Share
          </button>
          <button className="workspace-action workspace-action--primary" type="button" onClick={handleRunFile}>
            <Play size={16} />
            Run
          </button>
          <button className="workspace-action" type="button" onClick={onClose} aria-label="إغلاق مساحة العمل">
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="workspace-stage">
        <nav className="workspace-rail" aria-label="أقسام مساحة العمل">
          {railItems.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              className={`workspace-rail__button ${active ? "workspace-rail__button--active" : ""}`}
              type="button"
              aria-label={label}
            >
              <Icon size={18} />
            </button>
          ))}
        </nav>

        <aside className="workspace-sidebar" style={{ width: sidebarWidth }}>
          <section className="workspace-panel workspace-panel--tree">
            <div className="workspace-panel__header">
              <span className="workspace-panel__eyebrow">Explorer</span>
              <h2 className="workspace-panel__title">Project files</h2>
            </div>
            <FileExplorer onFileSelect={handleFileSelect} />
          </section>

          <section className="workspace-panel workspace-brief">
            <div className="workspace-panel__header">
              <span className="workspace-panel__eyebrow">Build brief</span>
              <h2 className="workspace-panel__title">Active prompt</h2>
            </div>

            <p className="workspace-brief__prompt" dir="rtl">
              {prompt || "صف المنتج المطلوب لبدء جلسة جديدة."}
            </p>

            <div className="workspace-brief__stats">
              <article className="workspace-brief__stat">
                <span className="workspace-brief__stat-label">Files</span>
                <strong className="workspace-brief__stat-value">{fileCount}</strong>
              </article>
              <article className="workspace-brief__stat">
                <span className="workspace-brief__stat-label">Tabs</span>
                <strong className="workspace-brief__stat-value">{openTabs.length}</strong>
              </article>
              <article className="workspace-brief__stat">
                <span className="workspace-brief__stat-label">Runtime</span>
                <strong className="workspace-brief__stat-value">
                  {termStatus === "disconnected" ? "Offline" : "Live"}
                </strong>
              </article>
            </div>
          </section>

          <div className="resize-handle resize-handle--horizontal" onMouseDown={handleSidebarResizeStart} />
        </aside>

        <main className="workspace-main">
          <div className="workspace-center-grid">
            <section className="workspace-editor-stack">
              <div className="workspace-toolbar">
                <div className="workspace-toolbar__cluster">
                  <span className="workspace-toolbar__chip">
                    <Sparkles size={14} />
                    Agent mode
                  </span>
                  <span className="workspace-toolbar__chip">
                    <Rocket size={14} />
                    Autosave
                  </span>
                </div>

                <div className="workspace-toolbar__meta">
                  <strong className="workspace-toolbar__filename">{activeFile?.name || "Select a file"}</strong>
                  <span className="workspace-toolbar__branch">launch/main</span>
                </div>
              </div>

              <div className="workspace-editor-surface">
                <EditorTabs
                  onTabContextMenu={(event, tab) => {
                    setTabContextMenu({ x: event.clientX, y: event.clientY, tabId: tab.id });
                  }}
                />

                <Breadcrumb fileId={activeTabId} />

                <div className="editor-container">
                  {activeFile && activeFile.type === "file" ? (
                    <Editor
                      height="100%"
                      language={activeFile.language || "plaintext"}
                      theme="cloud-max-theme"
                      value={activeFile.content || ""}
                      onChange={(newValue: string | undefined) => {
                        if (newValue === undefined) return;
                        updateFile(activeFile.id, { content: newValue });
                        markDirty(activeFile.id, true);
                      }}
                      beforeMount={((monaco) => {
                        monaco.editor.defineTheme("cloud-max-theme", {
                          base: "vs-dark",
                          inherit: true,
                          rules: [
                            { token: "comment", foreground: "6b7280", fontStyle: "italic" },
                            { token: "keyword", foreground: "ff8b5f", fontStyle: "bold" },
                            { token: "string", foreground: "7dd3fc" },
                            { token: "number", foreground: "f7b267" },
                            { token: "type", foreground: "c084fc" },
                            { token: "function", foreground: "fde68a" },
                            { token: "variable", foreground: "f3f4f6" },
                            { token: "operator", foreground: "fca5a5" },
                            { token: "tag", foreground: "f472b6" },
                            { token: "attribute.name", foreground: "f9a8d4" },
                            { token: "attribute.value", foreground: "93c5fd" }
                          ],
                          colors: {
                            "editor.background": "#12161f",
                            "editor.foreground": "#edf1f7",
                            "editor.lineHighlightBackground": "#1a202d",
                            "editorCursor.foreground": "#ff6a2b",
                            "editor.selectionBackground": "#ff6a2b25",
                            "editorIndentGuide.background": "#ffffff10",
                            "editorIndentGuide.activeBackground": "#ffffff22",
                            "editorWidget.background": "#171c26",
                            "editorWidget.border": "#2b3240",
                            "editorSuggestWidget.background": "#171c26",
                            "editorSuggestWidget.border": "#2b3240",
                            "editorSuggestWidget.selectedBackground": "#232b38",
                            "editorHoverWidget.background": "#171c26",
                            "editorHoverWidget.border": "#2b3240",
                            "editorGutter.background": "#12161f",
                            "editorLineNumber.foreground": "#566071",
                            "editorLineNumber.activeForeground": "#f5f7fb"
                          }
                        });
                      }) as BeforeMount}
                      onMount={((editor, monaco) => {
                        editorRef.current = editor;
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                          if (activeFile) markDirty(activeFile.id, false);
                        });
                        editor.focus();
                      }) as OnMount}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: "'IBM Plex Mono', 'Cascadia Code', monospace",
                        fontLigatures: true,
                        padding: { top: 18, bottom: 24 },
                        scrollBeyondLastLine: false,
                        lineHeight: 1.75,
                        letterSpacing: 0.2,
                        cursorBlinking: "smooth",
                        cursorSmoothCaretAnimation: "on",
                        smoothScrolling: true,
                        formatOnPaste: true,
                        formatOnType: true,
                        autoClosingBrackets: "always",
                        autoClosingQuotes: "always",
                        guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
                        renderLineHighlight: "all",
                        renderWhitespace: "selection",
                        stickyScroll: { enabled: true },
                        linkedEditing: true,
                        scrollbar: {
                          vertical: "auto",
                          horizontal: "auto",
                          verticalScrollbarSize: 8,
                          horizontalScrollbarSize: 8,
                          useShadows: false
                        }
                      }}
                    />
                  ) : (
                    <div className="editor-empty-state">
                      <LayoutPanelLeft size={44} />
                      <span>اختر ملفًا من الشجرة لبدء التحرير.</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className="workspace-sidepanel">
              <section className="sidecard">
                <div className="sidecard__header">
                  <span className="sidecard__eyebrow">Preview</span>
                  <h3 className="sidecard__title">Launch surface</h3>
                </div>

                <div className="preview-browser">
                  <div className="preview-browser__bar">
                    <span className="preview-browser__dot" />
                    <span className="preview-browser__dot" />
                    <span className="preview-browser__dot" />
                  </div>
                  <div className="preview-browser__surface">
                    <div className="preview-browser__panel" />
                    <div className="preview-browser__chart" />
                    <div className="preview-browser__metric">
                      <span className="preview-browser__metric-label">Conversion</span>
                      <strong className="preview-browser__metric-value">31.4%</strong>
                    </div>
                  </div>
                </div>
              </section>

              <section className="sidecard">
                <div className="sidecard__header">
                  <span className="sidecard__eyebrow">Agent plan</span>
                  <h3 className="sidecard__title">Execution feed</h3>
                </div>

                <div className="activity-list">
                  {activityItems.map((item) => (
                    <div key={item.label} className="activity-list__item">
                      <span className={`activity-list__status activity-list__status--${item.tone}`}>
                        <CircleDot size={12} />
                      </span>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="sidecard">
                <div className="sidecard__header">
                  <span className="sidecard__eyebrow">Collaborators</span>
                  <h3 className="sidecard__title">Live room</h3>
                </div>

                <div className="workspace-collaborators">
                  {collaboratorNames.map((name) => (
                    <span key={name} className="collaborator-pill">
                      <UsersRound size={13} />
                      {name}
                    </span>
                  ))}
                </div>
              </section>
            </aside>
          </div>

          <div className="resize-handle resize-handle--vertical" onMouseDown={handleTerminalResizeStart} />

          <div className="workspace-console-row" style={{ height: terminalHeight }}>
            <section className="terminal-shell">
              <div className="workspace-panel__header">
                <span className="workspace-panel__eyebrow">Runtime</span>
                <h2 className="workspace-panel__title">Console</h2>
              </div>
              <Terminal socket={socket} />
            </section>
          </div>

          <footer className="statusbar">
            <span className="statusbar__item">
              <span className={`status-dot ${termStatus === "disconnected" ? "status-dot--off" : ""}`} />
              {termStatus === "disconnected" ? "Socket offline" : "Socket live"}
            </span>
            <span className="statusbar__item">UTF-8</span>
            <span className="statusbar__item">TypeScript React</span>
            <span className="statusbar__item">Autosave on</span>
          </footer>
        </main>
      </div>

      {tabContextMenu && (
        <div
          className="tab-context-menu"
          style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={() => { closeTab(tabContextMenu.tabId); setTabContextMenu(null); }}>
            إغلاق
          </button>
          <button onClick={() => { closeOtherTabs(tabContextMenu.tabId); setTabContextMenu(null); }}>
            إغلاق البقية
          </button>
          <button onClick={() => { closeAllTabs(); setTabContextMenu(null); }}>
            إغلاق الكل
          </button>
        </div>
      )}
    </div>
  );
}
