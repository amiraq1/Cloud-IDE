import { useState, useEffect, useRef, useCallback } from "react";
import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import { io, Socket } from "socket.io-client";
import Terminal from "./Terminal";
import FileExplorer from "./FileExplorer";
import { useFileSystem, FileNode } from "../store/filesystem";

interface WorkspaceProps {
  prompt: string;
  onClose: () => void;
}

export default function Workspace({ prompt, onClose }: WorkspaceProps) {
  const { data, activeFileId, updateFile } = useFileSystem();
  const editorRef = useRef<any>(null);
  
  // Find active file recursively from standard tree
  const findNode = (nodes: FileNode[], id: string): FileNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };
  
  const activeFile = activeFileId ? findNode(data, activeFileId) : undefined;
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [termStatus, setTermStatus] = useState("disconnected");

  useEffect(() => {
    // Attempting to connect to the fastify backend on 8787 port
    const newSocket = io("http://localhost:8787", {
      transports: ['websocket'],
      autoConnect: true,
    });

    newSocket.on("connect", () => {
      setTermStatus("connected");
      console.log("Socket connected:", newSocket.id);
    });

    newSocket.on("disconnect", () => {
      setTermStatus("disconnected");
      console.log("Socket disconnected");
    });

    newSocket.on("runtime:status", (statusPayload: {status: string, detail: string}) => {
       setTermStatus(statusPayload.detail);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleRunFile = () => {
    if (socket && socket.connected && activeFile) {
      if (activeFile.type === "folder") {
        alert("لا يمكن تشغيل مجلد. يرجى تحديد ملف كود.");
        return;
      }
      socket.emit("runtime:run", {
        code: activeFile.content || "",
        fileName: activeFile.name,
        language: activeFile.language || "typescript"
      });
    }
  };

  return (
    <div className="avant-workspace-shell">
      {/* Top Navbar */}
      <header className="workspace-header">
        <div className="workspace-header__meta">
          <span className="workspace-brand__dot" />
          <span className="workspace-brand__text">Cloud IDE <span>ماكس</span></span>
          <span className="workspace-divider" />
          <span className="workspace-project-name">مشروع السحابة المتقدم (VFS)</span>
        </div>
        
        <div className="workspace-header__actions">
          <button className="avant-btn avant-btn--ghost close-workspace-btn" onClick={onClose} aria-label="إغلاق مساحة العمل">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <button className="workspace-deploy-btn" onClick={handleRunFile}>
             اختبار التنفيذ (Run)
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-14 9V3z"/></svg>
          </button>
        </div>
      </header>

      {/* Main Ide Split */}
      <div className="workspace-grid" style={{ gridTemplateColumns: '260px 1fr 1fr' }}>
        
        {/* Sidebar - VFS Tree */}
        <aside className="workspace-sidebar" style={{ background: '#09090b', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="flex-1 overflow-hidden">
             <FileExplorer onFileSelect={(file) => {
               console.log("Selected file:", file.name);
             }} />
          </div>
          <div className="sidebar-meta" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="sidebar-title">توجيه التوليد الأساسي</h3>
            <div className="prompt-display" dir="auto">
               "{prompt}"
            </div>
            <div className="status-badge pulse-active">
              <span className="status-badge__dot" style={{ background: termStatus === 'disconnected' ? '#ef4444' : '#10b981' }} />
              {termStatus === "disconnected" ? "غير متصل بالمرساة" : termStatus}
            </div>
          </div>
        </aside>

        {/* Editor Pane */}
        <div className="workspace-editor-pane">
          <div className="pane-header">
            <div className="pane-tabs">
              {activeFile && activeFile.type === "file" ? (
                 <div className="pane-tab active">
                    {activeFile.name}
                 </div>
              ) : (
                 <div className="pane-tab" style={{color: '#71717a'}}>
                    لا يوجد ملف نشط
                 </div>
              )}
            </div>
          </div>
          <div className="editor-container" style={{ background: '#1e1e1e' }}>
            {activeFile && activeFile.type === "file" ? (
              <Editor
                height="100%"
                language={activeFile.language || "plaintext"}
                theme="cloud-max-theme"
                value={activeFile.content || ""}
                onChange={(newVal: string | undefined) => {
                  if (newVal !== undefined) {
                    updateFile(activeFile.id, { content: newVal });
                  }
                }}
                beforeMount={((monaco) => {
                   // ═══════════════════════════════════════════
                   // CODE_EDITOR_ELITE: Theme & Language Config
                   // ═══════════════════════════════════════════
                   monaco.editor.defineTheme('cloud-max-theme', {
                      base: 'vs-dark',
                      inherit: true,
                      rules: [
                         // Core Syntax
                         { token: 'comment', foreground: '52525b', fontStyle: 'italic' },
                         { token: 'keyword', foreground: 'efb13f', fontStyle: 'bold' },
                         { token: 'keyword.control', foreground: 'f59e0b' },
                         { token: 'string', foreground: '34d399' },
                         { token: 'string.escape', foreground: '6ee7b7' },
                         { token: 'number', foreground: '60a5fa' },
                         { token: 'number.hex', foreground: '93c5fd' },
                         // Functions & Types
                         { token: 'type', foreground: '38bdf8', fontStyle: 'italic' },
                         { token: 'type.identifier', foreground: '7dd3fc' },
                         { token: 'function', foreground: 'c084fc' },
                         { token: 'function.declaration', foreground: 'a78bfa', fontStyle: 'bold' },
                         // Variables & Operators
                         { token: 'variable', foreground: 'e2e8f0' },
                         { token: 'variable.predefined', foreground: 'fbbf24' },
                         { token: 'constant', foreground: 'fb923c', fontStyle: 'bold' },
                         { token: 'operator', foreground: 'f472b6' },
                         // Tags (HTML/JSX)
                         { token: 'tag', foreground: 'f87171' },
                         { token: 'attribute.name', foreground: 'fbbf24' },
                         { token: 'attribute.value', foreground: '34d399' },
                         // Decorators & Meta
                         { token: 'annotation', foreground: 'fb923c', fontStyle: 'italic' },
                         { token: 'delimiter', foreground: '71717a' },
                         { token: 'delimiter.bracket', foreground: '94a3b8' },
                         // Regex
                         { token: 'regexp', foreground: 'f472b6' },
                      ],
                      colors: {
                         'editor.background': '#0c0c0e',
                         'editor.foreground': '#d6d0c8',
                         'editor.lineHighlightBackground': '#efb13f08',
                         'editor.lineHighlightBorder': '#efb13f15',
                         'editorCursor.foreground': '#efb13f',
                         'editorCursor.background': '#000000',
                         'editor.selectionBackground': '#efb13f25',
                         'editor.selectionHighlightBackground': '#efb13f12',
                         'editor.wordHighlightBackground': '#efb13f18',
                         'editor.findMatchBackground': '#efb13f40',
                         'editor.findMatchHighlightBackground': '#efb13f20',
                         'editorIndentGuide.background': '#ffffff06',
                         'editorIndentGuide.activeBackground': '#efb13f40',
                         'editorBracketMatch.background': '#efb13f20',
                         'editorBracketMatch.border': '#efb13f60',
                         'editorWidget.background': '#18181b',
                         'editorWidget.border': '#27272a',
                         'editorSuggestWidget.background': '#18181b',
                         'editorSuggestWidget.border': '#27272a',
                         'editorSuggestWidget.selectedBackground': '#efb13f15',
                         'editorSuggestWidget.highlightForeground': '#efb13f',
                         'editorHoverWidget.background': '#18181b',
                         'editorHoverWidget.border': '#27272a',
                         'editorGutter.background': '#0c0c0e',
                         'editorLineNumber.foreground': '#3f3f46',
                         'editorLineNumber.activeForeground': '#efb13f',
                      }
                   });

                   // ═══════════════════════════════════════════
                   // CODE_EDITOR_ELITE: Custom Completion Provider
                   // ═══════════════════════════════════════════
                   const cloudSnippets = [
                     { label: 'clf', insertText: 'const ${1:name} = (${2:params}) => {\n\t${3}\n};', detail: 'Arrow Function (Cloud Snippet)', kind: monaco.languages.CompletionItemKind.Snippet },
                     { label: 'clcomp', insertText: 'export default function ${1:ComponentName}({ ${2:props} }: ${3:Props}) {\n\treturn (\n\t\t<div>\n\t\t\t${4}\n\t\t</div>\n\t);\n}', detail: 'React Component (Cloud Snippet)', kind: monaco.languages.CompletionItemKind.Snippet },
                     { label: 'clstate', insertText: 'const [${1:state}, set${2:State}] = useState<${3:type}>(${4:initial});', detail: 'useState Hook (Cloud Snippet)', kind: monaco.languages.CompletionItemKind.Snippet },
                     { label: 'cleffect', insertText: 'useEffect(() => {\n\t${1}\n\n\treturn () => {\n\t\t${2:// cleanup}\n\t};\n}, [${3}]);', detail: 'useEffect Hook (Cloud Snippet)', kind: monaco.languages.CompletionItemKind.Snippet },
                     { label: 'clfetch', insertText: 'const response = await fetch("${1:url}", {\n\tmethod: "${2|GET,POST,PUT,DELETE|}",\n\theaders: { "Content-Type": "application/json" },\n\t${3:body: JSON.stringify(data)}\n});\nconst result = await response.json();', detail: 'Fetch API (Cloud Snippet)', kind: monaco.languages.CompletionItemKind.Snippet },
                     { label: 'clzustand', insertText: 'export const use${1:Store} = create<${2:StoreType}>((set) => ({\n\t${3:state}: ${4:initialValue},\n\t${5:action}: (${6:params}) => set((state) => ({\n\t\t${7}\n\t})),\n}));', detail: 'Zustand Store (Cloud Snippet)', kind: monaco.languages.CompletionItemKind.Snippet },
                     { label: 'cltry', insertText: 'try {\n\t${1}\n} catch (error) {\n\tconsole.error("[Cloud IDE Error]:", error);\n\t${2}\n}', detail: 'Try-Catch (Cloud Snippet)', kind: monaco.languages.CompletionItemKind.Snippet },
                   ];

                   // Register for TypeScript, JavaScript, Python
                   ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].forEach(lang => {
                     monaco.languages.registerCompletionItemProvider(lang, {
                       provideCompletionItems: (model: any, position: any) => {
                         const word = model.getWordUntilPosition(position);
                         const range = {
                           startLineNumber: position.lineNumber,
                           endLineNumber: position.lineNumber,
                           startColumn: word.startColumn,
                           endColumn: word.endColumn
                         };
                         return {
                           suggestions: cloudSnippets.map(s => ({
                             ...s,
                             range,
                             insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                           }))
                         };
                       }
                     });
                   });

                }) as BeforeMount}
                onMount={((editor, monaco) => {
                   // ═══════════════════════════════════════════
                   // CODE_EDITOR_ELITE: Runtime Keybindings & Focus
                   // ═══════════════════════════════════════════
                   editorRef.current = editor;

                   // Ctrl+S / Cmd+S — Save (prevent browser default)
                   editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                     console.log('[Cloud IDE] File saved:', activeFile?.name);
                   });

                   // Ctrl+D — Duplicate Line
                   editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
                     editor.getAction('editor.action.copyLinesDownAction')?.run();
                   });

                   // Auto-focus the editor on mount
                   editor.focus();
                }) as OnMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "'IBM Plex Mono', 'Cascadia Code', 'Fira Code', monospace",
                  fontLigatures: true,
                  padding: { top: 20, bottom: 20 },
                  scrollBeyondLastLine: false,
                  lineHeight: 1.7,
                  letterSpacing: 0.3,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  cursorWidth: 2,
                  smoothScrolling: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  autoClosingBrackets: 'always',
                  autoClosingQuotes: 'always',
                  autoSurround: 'languageDefined',
                  bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
                  guides: { bracketPairs: true, bracketPairsHorizontal: true, indentation: true, highlightActiveIndentation: true },
                  renderLineHighlight: "all",
                  renderWhitespace: 'selection',
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: { other: true, comments: false, strings: true },
                  acceptSuggestionOnCommitCharacter: true,
                  tabCompletion: 'on',
                  parameterHints: { enabled: true, cycle: true },
                  suggest: {
                    showSnippets: true,
                    showKeywords: true,
                    showClasses: true,
                    showFunctions: true,
                    showVariables: true,
                    showModules: true,
                    insertMode: 'replace',
                    preview: true,
                    filterGraceful: true,
                  },
                  inlineSuggest: { enabled: true },
                  stickyScroll: { enabled: true },
                  linkedEditing: true,
                  hideCursorInOverviewRuler: true,
                  overviewRulerBorder: false,
                  scrollbar: {
                      vertical: 'auto',
                      horizontal: 'auto',
                      verticalScrollbarSize: 6,
                      horizontalScrollbarSize: 6,
                      useShadows: false,
                  },
                  mouseWheelZoom: true,
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full w-full opacity-30 select-none pointer-events-none">
                 <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5">
                   <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                 </svg>
              </div>
            )}
          </div>
        </div>

        {/* Console / Preview Split (Vertical) */}
        <div className="workspace-preview-pane">
          <div className="pane-header">
            <span className="preview-label">وحدة التوجيه الطرفية (Terminal)</span>
            <div className="preview-controls">
              <span style={{color: 'var(--accent)'}}>{termStatus === 'connected' ? 'متصل عتادياً' : termStatus}</span>
            </div>
          </div>
          
          <div className="preview-container" style={{ padding: '0.5rem', background: '#000' }}>
            <Terminal socket={socket} />
          </div>
        </div>
      </div>
    </div>
  );
}
