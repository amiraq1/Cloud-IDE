import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  socket: Socket | null;
  className?: string;
}

export default function Terminal({ socket, className = "" }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm with Avant-Garde aesthetic
    const term = new XTerm({
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: '#09090b', // Deep void match
        foreground: '#e4e4e7',
        cursor: '#efb13f',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(239, 177, 63, 0.3)',
        black: '#000000',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#efb13f',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#ffffff',
      },
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: true,
      disableStdin: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    // Delay open to ensure dimensions exist, dodging xterm's internal 'get dimensions' crash
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!isMounted || !terminalRef.current) return;
        
        try {
          term.open(terminalRef.current);
          
          xtermRef.current = term;
          fitAddonRef.current = fitAddon;

          term.writeln('\x1b[33;1m»\x1b[0m Cloud IDE Max Runtime Environment Executing...');
          term.writeln('\x1b[90mConnecting to execution socket bridge...\x1b[0m');

          const tryFit = () => {
            try {
              if (terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
                fitAddon.fit();
              }
            } catch (err) { }
          };

          // Use ResizeObserver for robust fitting when the grid container animates/resize
          resizeObserver = new ResizeObserver(() => {
             requestAnimationFrame(() => {
                tryFit();
             });
          });

          resizeObserver.observe(terminalRef.current);
          tryFit();
        } catch(e) {
          console.error("XTerm open failed:", e);
        }
      }, 50);
    });

    return () => {
      isMounted = false;
      if (resizeObserver) resizeObserver.disconnect();
      term.dispose();
    };
  }, []); // Only run once on mount

  // Sync with socket
  useEffect(() => {
    const term = xtermRef.current;
    if (!term || !socket) return;

    // Handle user typing directly into terminal
    const onDataDisposable = term.onData((data) => {
      socket.emit('terminal:input', { data });
    });

    // Handle data coming from server's PTY
    const handlePtyData = (payload: { data: string }) => {
      term.write(payload.data);
    };

    // Old bridge line handlers (fallback for mock)
    const handleRuntimeLine = (payload: { kind: string, text: string }) => {
        let prefix = '';
        if (payload.kind === 'system') prefix = '\x1b[34m[sys]\x1b[0m ';
        if (payload.kind === 'stderr') prefix = '\x1b[31;1m[err]\x1b[0m ';
        if (payload.kind === 'stdout') prefix = '\x1b[32m[out]\x1b[0m ';
        term.writeln(prefix + payload.text);
    };

    socket.on('pty:data', handlePtyData);
    socket.on('runtime:line', handleRuntimeLine);

    return () => {
      onDataDisposable.dispose();
      socket.off('pty:data', handlePtyData);
      socket.off('runtime:line', handleRuntimeLine);
    };
  }, [socket]);

  return (
    <div 
      ref={terminalRef} 
      className={`avant-terminal-container ${className}`}
      style={{ height: '100%', width: '100%', overflow: 'hidden' }}
      dir="ltr" // Terminals should almost always be LTR even in RTL dashboards
    />
  );
}
