import React, { useRef, useState, useCallback } from "react";
import {
  XIcon,
  FileCodeIcon,
  FileJsonIcon,
  FileTextIcon,
  FileIcon,
} from "lucide-react";
import { useTabs, Tab } from "../store/tabs";

// ═══════════════════════════════════════════
// EDITOR_TABS_ELITE: Multi-Tab Bar Component
// ═══════════════════════════════════════════

const getTabIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "ts" || ext === "tsx")
    return <FileCodeIcon size={13} style={{ color: "#3b82f6" }} />;
  if (ext === "js" || ext === "jsx")
    return <FileCodeIcon size={13} style={{ color: "#eab308" }} />;
  if (ext === "json")
    return <FileJsonIcon size={13} style={{ color: "#10b981" }} />;
  if (ext === "py")
    return <FileCodeIcon size={13} style={{ color: "#60a5fa" }} />;
  if (ext === "html")
    return <FileCodeIcon size={13} style={{ color: "#f97316" }} />;
  if (ext === "css")
    return <FileCodeIcon size={13} style={{ color: "#a78bfa" }} />;
  if (ext === "md")
    return <FileTextIcon size={13} style={{ color: "#94a3b8" }} />;
  return <FileIcon size={13} style={{ color: "#71717a" }} />;
};

interface EditorTabsProps {
  onTabContextMenu?: (e: React.MouseEvent, tab: Tab) => void;
}

const EditorTabs: React.FC<EditorTabsProps> = ({ onTabContextMenu }) => {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useTabs();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY * 0.6;
    }
  }, []);

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx !== null && dragIdx !== idx) {
      useTabs.getState().reorderTabs(dragIdx, idx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  if (openTabs.length === 0) {
    return (
      <div className="editor-tabs-bar editor-tabs-bar--empty">
        <span className="editor-tabs-bar__ghost">لا توجد ملفات مفتوحة</span>
      </div>
    );
  }

  return (
    <div className="editor-tabs-bar" ref={scrollRef} onWheel={handleWheel}>
      {openTabs.map((tab, idx) => {
        const isActive = tab.id === activeTabId;
        const isDragging = dragIdx === idx;
        const isDragTarget = dragOverIdx === idx;

        return (
          <div
            key={tab.id}
            className={`editor-tab ${isActive ? "editor-tab--active" : ""} ${isDragging ? "editor-tab--dragging" : ""} ${isDragTarget ? "editor-tab--drop-target" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              onTabContextMenu?.(e, tab);
            }}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
          >
            <span className="editor-tab__icon">{getTabIcon(tab.name)}</span>
            <span className="editor-tab__name" dir="ltr">
              {tab.name}
            </span>

            {/* Dirty indicator */}
            {tab.isDirty && <span className="editor-tab__dirty" />}

            {/* Close button */}
            <button
              className="editor-tab__close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              aria-label={`إغلاق ${tab.name}`}
            >
              <XIcon size={12} />
            </button>

            {/* Active indicator line */}
            {isActive && <div className="editor-tab__indicator" />}
          </div>
        );
      })}
    </div>
  );
};

export default EditorTabs;
