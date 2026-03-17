import React, { useRef, useState, useEffect } from "react";
import { Tree, NodeApi } from "react-arborist";
import { 
  FolderIcon, 
  FileIcon, 
  ChevronRightIcon, 
  ChevronDownIcon, 
  FileCodeIcon,
  FileJsonIcon,
  FileTextIcon,
  Trash2Icon,
  Edit2Icon,
  CopyIcon,
  FolderPlusIcon,
  FilePlusIcon,
  SearchIcon,
  ArchiveRestoreIcon,
  XIcon,
  LockIcon,
  DownloadIcon,
} from "lucide-react";
import { useFileSystem, FileNode, FileType } from "../store/filesystem";

interface FileExplorerProps {
  onFileSelect: (file: FileNode) => void;
}

// ═══════════════════════════════════════════
// FILE_SYSTEM_MASTER: Context Menu Component
// ═══════════════════════════════════════════
const ContextMenu: React.FC<{
  x: number; 
  y: number; 
  nodeId: string;
  onClose: () => void;
}> = ({ x, y, nodeId, onClose }) => {
  const { softDelete, duplicateFile, findNode, data, setActiveFile, updateFile } = useFileSystem();
  const node = findNode(data, nodeId);
  const isFolder = node?.type === 'folder';

  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [onClose]);

  const menuItems = [
    ...(isFolder ? [] : [
      { label: '\u0641\u062A\u062D', icon: <FileIcon size={13} />, action: () => { setActiveFile(nodeId); onClose(); } },
      { label: '\u062A\u0643\u0631\u0627\u0631', icon: <CopyIcon size={13} />, action: () => { duplicateFile(nodeId); onClose(); } },
    ]),
    ...(isFolder ? [
      { label: '\u0645\u0644\u0641 \u062C\u062F\u064A\u062F \u0647\u0646\u0627', icon: <FilePlusIcon size={13} />, action: () => {
        const name = prompt("\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u062C\u062F\u064A\u062F\u061F", "untitled.ts");
        if (name) {
          const ext = name.split('.').pop();
          let lang = 'typescript';
          if (ext === 'py') lang = 'python';
          if (ext === 'html') lang = 'html';
          if (ext === 'css') lang = 'css';
          if (ext === 'json') lang = 'json';
          useFileSystem.getState().createFile(nodeId, { name, type: 'file', language: lang, content: '' });
        }
        onClose();
      }},
      { label: '\u0645\u062C\u0644\u062F \u062C\u062F\u064A\u062F \u0647\u0646\u0627', icon: <FolderPlusIcon size={13} />, action: () => {
        const name = prompt("\u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0644\u062F \u0627\u0644\u062C\u062F\u064A\u062F\u061F", "new-folder");
        if (name) useFileSystem.getState().createFolder(nodeId, name);
        onClose();
      }},
    ] : []),
    { divider: true } as any,
    { label: node?.isLocked ? '\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0642\u0641\u0644' : '\u0642\u0641\u0644 \u0627\u0644\u0645\u0644\u0641', icon: <LockIcon size={13} />, action: () => {
      updateFile(nodeId, { isLocked: !node?.isLocked });
      onClose();
    }},
    { label: '\u0646\u0642\u0644 \u0625\u0644\u0649 \u0627\u0644\u0633\u0644\u0629', icon: <Trash2Icon size={13} />, action: () => { softDelete(nodeId); onClose(); }, danger: true },
  ];

  return (
    <div 
      className="fixed z-[999] min-w-[180px] py-1 rounded-lg shadow-2xl border border-white/10 overflow-hidden"
      style={{ 
        left: x, 
        top: y, 
        background: 'rgba(24, 24, 27, 0.95)', 
        backdropFilter: 'blur(16px)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item: any, i: number) => 
        item.divider ? (
          <div key={i} className="border-t border-white/5 my-1" />
        ) : (
          <button
            key={i}
            onClick={item.action}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-right ${
              item.danger 
                ? 'text-red-400 hover:bg-red-400/10' 
                : 'text-zinc-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="opacity-60">{item.icon}</span>
            {item.label}
          </button>
        )
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
// FILE_SYSTEM_MASTER: Trash Panel Component
// ═══════════════════════════════════════════
const TrashPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { trash, restoreFile, emptyTrash } = useFileSystem();

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'rgba(9,9,11,0.97)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-xs font-bold text-zinc-400">\u0633\u0644\u0629 \u0627\u0644\u0645\u062D\u0630\u0648\u0641\u0627\u062A ({trash.length})</span>
        <div className="flex gap-2">
          {trash.length > 0 && (
            <button onClick={emptyTrash} className="text-[10px] text-red-400 hover:text-red-300">\u062A\u0641\u0631\u064A\u063A \u0627\u0644\u0633\u0644\u0629</button>
          )}
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><XIcon size={14} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {trash.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center mt-8">\u0627\u0644\u0633\u0644\u0629 \u0641\u0627\u0631\u063A\u0629</p>
        ) : (
          trash.map(node => (
            <div key={node.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5 text-zinc-400 text-xs group">
              <span className="flex items-center gap-2" dir="ltr">
                {node.type === 'folder' ? <FolderIcon size={13} /> : <FileIcon size={13} />}
                {node.name}
              </span>
              <button 
                onClick={() => restoreFile(node.id)}
                className="opacity-0 group-hover:opacity-100 text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-opacity"
              >
                <ArchiveRestoreIcon size={12} />
                <span>\u0627\u0633\u062A\u0639\u0627\u062F\u0629</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// FILE_SYSTEM_MASTER: Main FileExplorer
// ═══════════════════════════════════════════
const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect }) => {
  const { 
    data, activeFileId, setActiveFile, setData, deleteFile, updateFile,
    searchQuery, setSearchQuery, getFilteredData,
    contextMenu, setContextMenu,
    trash, softDelete, createFolder, duplicateFile,
  } = useFileSystem();
  const treeRef = useRef<any>(null);
  const [showTrash, setShowTrash] = useState(false);

  const displayData = searchQuery.trim() ? getFilteredData() : data;

  // The rendering of individual nodes in the tree
  const Node = ({ node, style, dragHandle }: { node: NodeApi<FileNode>, style: any, dragHandle?: any }) => {
    const isFolder = node.data.type === "folder";
    const isActive = activeFileId === node.data.id;
    const isLocked = node.data.isLocked;
    
    // Icon Logic Based On Type and Extension
    const getIcon = () => {
      if (isFolder) {
        return node.isOpen 
          ? <ChevronDownIcon size={14} className="text-[#efb13f]" /> 
          : <ChevronRightIcon size={14} />;
      }
      
      const ext = node.data.name.split('.').pop()?.toLowerCase();
      if (ext === 'ts' || ext === 'tsx') return <FileCodeIcon size={14} style={{ color: '#3b82f6' }} />;
      if (ext === 'js' || ext === 'jsx') return <FileCodeIcon size={14} style={{ color: '#eab308' }} />;
      if (ext === 'json') return <FileJsonIcon size={14} style={{ color: '#10b981' }} />;
      if (ext === 'py') return <FileCodeIcon size={14} style={{ color: '#60a5fa' }} />;
      if (ext === 'html') return <FileCodeIcon size={14} style={{ color: '#f97316' }} />;
      if (ext === 'css') return <FileCodeIcon size={14} style={{ color: '#a78bfa' }} />;
      if (ext === 'md') return <FileTextIcon size={14} style={{ color: '#94a3b8' }} />;
      
      return <FileIcon size={14} className="text-gray-400" />;
    };

    return (
      <div 
        ref={dragHandle} 
        style={style} 
        className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer group transition-all duration-150 select-none ${
          isActive 
            ? 'bg-[#efb13f]/10 text-[#efb13f]' 
            : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
        } ${isLocked ? 'opacity-60' : ''}`}
        onClick={() => {
          if (isFolder) {
             node.toggle();
          } else {
             setActiveFile(node.data.id);
             onFileSelect(node.data);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.data.id });
        }}
      >
        <span className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
          {getIcon()}
        </span>
        
        {/* Inline Edit Form vs Static Text */}
        {node.isEditing ? (
          <input
            type="text"
            autoFocus
            className="bg-black/50 border border-[#efb13f]/50 rounded px-1 outline-none text-sm w-full font-mono text-zinc-100"
            defaultValue={node.data.name}
            dir="ltr"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") node.submit(e.currentTarget.value);
              if (e.key === "Escape") node.reset();
            }}
            onBlur={() => node.reset()}
          />
        ) : (
          <span className="truncate flex-1 text-sm font-medium" dir="ltr">
            {node.data.name}
          </span>
        )}

        {/* Lock indicator */}
        {isLocked && <LockIcon size={10} className="text-zinc-600 flex-shrink-0" />}

        {/* Hover Actions (Edit / Delete) */}
        {!node.isEditing && !isLocked && (
           <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity flex-shrink-0">
              <button 
                onClick={(e) => { e.stopPropagation(); node.edit(); }}
                className="p-1 hover:text-white rounded hover:bg-white/10"
                title="\u0625\u0639\u0627\u062F\u0629 \u062A\u0633\u0645\u064A\u0629"
              >
                <Edit2Icon size={11} />
              </button>
              {!isFolder && (
                <button 
                  onClick={(e) => { e.stopPropagation(); duplicateFile(node.data.id); }}
                  className="p-1 hover:text-white rounded hover:bg-white/10"
                  title="\u062A\u0643\u0631\u0627\u0631"
                >
                  <CopyIcon size={11} />
                </button>
              )}
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  softDelete(node.data.id);
                }}
                className="p-1 hover:text-red-400 rounded hover:bg-red-400/10"
                title="\u062D\u0630\u0641"
              >
                <Trash2Icon size={11} />
              </button>
           </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full p-2 overflow-hidden flex flex-col font-sans relative" dir="rtl">
      {/* VFS Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
          \u0645\u0633\u062A\u0643\u0634\u0641 \u0627\u0644\u0645\u0644\u0641\u0627\u062A
        </h3>
        <div className="flex items-center gap-1">
          <button 
            className="p-1 text-zinc-500 hover:text-[#efb13f] transition-colors rounded hover:bg-white/5"
            title="\u0645\u0644\u0641 \u062C\u062F\u064A\u062F"
            onClick={() => {
              const name = prompt("\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u062C\u062F\u064A\u062F\u061F", "untitled.ts");
              if (name) {
                const ext = name.split('.').pop();
                let lang = 'typescript';
                if (ext === 'py') lang = 'python';
                if (ext === 'html') lang = 'html';
                if (ext === 'css') lang = 'css';
                if (ext === 'json') lang = 'json';
                useFileSystem.getState().createFile('root', {
                  name, type: 'file', language: lang, content: ''
                });
              }
            }}
          >
            <FilePlusIcon size={14} />
          </button>
          <button 
            className="p-1 text-zinc-500 hover:text-[#efb13f] transition-colors rounded hover:bg-white/5"
            title="\u0645\u062C\u0644\u062F \u062C\u062F\u064A\u062F"
            onClick={() => {
              const name = prompt("\u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0644\u062F \u0627\u0644\u062C\u062F\u064A\u062F\u061F", "new-folder");
              if (name) createFolder('root', name);
            }}
          >
            <FolderPlusIcon size={14} />
          </button>
          <button 
            className={`p-1 transition-colors rounded hover:bg-white/5 ${trash.length > 0 ? 'text-red-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title={`\u0633\u0644\u0629 \u0627\u0644\u0645\u062D\u0630\u0648\u0641\u0627\u062A (${trash.length})`}
            onClick={() => setShowTrash(true)}
          >
            <Trash2Icon size={14} />
            {trash.length > 0 && (
              <span className="absolute -mt-3 mr-2 bg-red-500 text-[8px] text-white rounded-full w-3 h-3 flex items-center justify-center font-bold">
                {trash.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-2 px-1">
        <SearchIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="\u0628\u062D\u062B..."
          dir="ltr"
          className="w-full bg-white/3 border border-white/5 rounded-md px-2 py-1 pl-7 text-xs text-zinc-300 placeholder-zinc-600 outline-none focus:border-[#efb13f]/30 transition-colors font-mono"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            <XIcon size={12} />
          </button>
        )}
      </div>

      {/* Arborist Tree Engine */}
      <div className="flex-1 overflow-y-auto w-full custom-scrollbar" dir="ltr">
        <Tree
          ref={treeRef}
          data={displayData}
          width="100%"
          height={600}
          indent={16}
          rowHeight={30}
          openByDefault={false}
          
          // DND Logic (synced with Zustand)
          onMove={({ dragIds, parentId, index }) => {
            if (dragIds[0]) {
              useFileSystem.getState().moveFile(dragIds[0], parentId || null, index);
            }
          }}
          
          // Rename Logic
          onRename={({ node, name }) => {
            if (name.trim()) {
              updateFile(node.data.id, { name });
            }
          }}
        >
          {Node}
        </Tree>
      </div>

      {/* Context Menu Portal */}
      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          nodeId={contextMenu.nodeId}
          onClose={() => setContextMenu(null)} 
        />
      )}

      {/* Trash Panel */}
      {showTrash && <TrashPanel onClose={() => setShowTrash(false)} />}
    </div>
  );
};

export default FileExplorer;
