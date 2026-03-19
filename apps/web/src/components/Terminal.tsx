import React, { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Socket } from "socket.io-client";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  socket: Socket | null;
  className?: string;
}

export default function Terminal({ socket, className = "" }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#0d1016",
        foreground: "#eef2f8",
        cursor: "#ff6a2b",
        cursorAccent: "#0d1016",
        selectionBackground: "rgba(255, 106, 43, 0.24)",
        black: "#000000",
        red: "#f87171",
        green: "#34d399",
        yellow: "#f7a76c",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#ffffff"
      },
      cursorBlink: true,
      cursorStyle: "block",
      convertEol: true,
      disableStdin: false
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;
    let openFrame: number | null = null;
    let openTimer: number | null = null;

    openFrame = requestAnimationFrame(() => {
      openTimer = window.setTimeout(() => {
        if (!isMounted || !terminalRef.current) return;

        try {
          term.open(terminalRef.current);
          xtermRef.current = term;
          fitAddonRef.current = fitAddon;
          setIsReady(true);

          term.writeln("\x1b[38;5;208mCloud IDE Agent Runtime\x1b[0m");
          term.writeln("\x1b[90mConnecting to execution socket bridge...\x1b[0m");

          const tryFit = () => {
            try {
              if (terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
                fitAddon.fit();
              }
            } catch {
              // Ignore transient fit errors while the layout is settling.
            }
          };

          resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => {
              tryFit();
            });
          });

          resizeObserver.observe(terminalRef.current);
          tryFit();
        } catch (error) {
          console.error("XTerm open failed:", error);
        }
      }, 50);
    });

    return () => {
      isMounted = false;
      setIsReady(false);
      if (openFrame !== null) cancelAnimationFrame(openFrame);
      if (openTimer !== null) window.clearTimeout(openTimer);
      if (resizeObserver) resizeObserver.disconnect();
      xtermRef.current = null;
      fitAddonRef.current = null;
      term.dispose();
    };
  }, []);

  useEffect(() => {
    const term = xtermRef.current;
    if (!term || !socket || !isReady) return;

    const onDataDisposable = term.onData((data) => {
      if (socket.connected) {
        socket.emit("terminal:input", { data });
      }
    });

    const handlePtyData = (payload: { data: string }) => {
      term.write(payload.data);
    };

    socket.on("pty:data", handlePtyData);

    return () => {
      onDataDisposable.dispose();
      socket.off("pty:data", handlePtyData);
    };
  }, [socket, isReady]);

  return (
    <div
      ref={terminalRef}
      className={`avant-terminal-container ${className}`}
      style={{ height: "100%", width: "100%", overflow: "hidden" }}
      dir="ltr"
    />
  );
}
