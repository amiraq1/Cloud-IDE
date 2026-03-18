import { useRef, useState, useEffect } from "react";
import { Tree, NodeApi } from "react-arborist";
import {
  ArchiveRestoreIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  Edit2Icon,
  FileCodeIcon,
  FileIcon,
  FileJsonIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  LockIcon,
  SearchIcon,
  Trash2Icon,
  XIcon
} from "lucide-react";
import { useFileSystem, FileNode } from "../store/filesystem";

interface FileExplorerProps {
  onFileSelect: (file: FileNode) => void;
}

const ContextMenu = ({
  x,
  y,
  nodeId,
  onClose
}: {
  x: number;
  y: number;
  nodeId: string;
  onClose: () => void;
}) => {
  const { softDelete, duplicateFile, findNode, data, setActiveFile, updateFile } = useFileSystem();
  const node = findNode(data, nodeId);
  const isFolder = node?.type === "folder";

  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [onClose]);

  const menuItems = [
    ...(isFolder
      ? []
      : [
          {
            label: "فتح",
            icon: <FileIcon size={13} />,
            action: () => {
              setActiveFile(nodeId);
              onClose();
            }
          },
          {
            label: "تكرار",
            icon: <CopyIcon size={13} />,
            action: () => {
              duplicateFile(nodeId);
              onClose();
            }
          }
        ]),
    ...(isFolder
      ? [
          {
            label: "ملف جديد هنا",
            icon: <FilePlusIcon size={13} />,
            action: () => {
              const name = prompt("اسم الملف الجديد؟", "untitled.ts");
              if (name) {
                const ext = name.split(".").pop();
                let lang = "typescript";
                if (ext === "tsx") lang = "typescriptreact";
                if (ext === "py") lang = "python";
                if (ext === "html") lang = "html";
                if (ext === "css") lang = "css";
                if (ext === "json") lang = "json";
                useFileSystem.getState().createFile(nodeId, {
                  name,
                  type: "file",
                  language: lang,
                  content: ""
                });
              }
              onClose();
            }
          },
          {
            label: "مجلد جديد هنا",
            icon: <FolderPlusIcon size={13} />,
            action: () => {
              const name = prompt("اسم المجلد الجديد؟", "new-folder");
              if (name) useFileSystem.getState().createFolder(nodeId, name);
              onClose();
            }
          }
        ]
      : []),
    { divider: true },
    {
      label: node?.isLocked ? "إلغاء القفل" : "قفل الملف",
      icon: <LockIcon size={13} />,
      action: () => {
        updateFile(nodeId, { isLocked: !node?.isLocked });
        onClose();
      }
    },
    {
      label: "نقل إلى السلة",
      icon: <Trash2Icon size={13} />,
      action: () => {
        softDelete(nodeId);
        onClose();
      },
      danger: true
    }
  ];

  return (
    <div className="context-popover" style={{ left: x, top: y }} onClick={(event) => event.stopPropagation()}>
      {menuItems.map((item, index) =>
        "divider" in item ? (
          <div key={index} className="context-popover__divider" />
        ) : (
          <button
            key={item.label}
            onClick={item.action}
            className={`context-popover__button ${item.danger ? "context-popover__button--danger" : ""}`}
          >
            {item.icon}
            {item.label}
          </button>
        )
      )}
    </div>
  );
};

const TrashPanel = ({ onClose }: { onClose: () => void }) => {
  const { trash, restoreFile, emptyTrash } = useFileSystem();

  return (
    <div className="trash-drawer">
      <div className="trash-drawer__header">
        <strong className="trash-drawer__title">سلة المحذوفات ({trash.length})</strong>
        <div className="trash-drawer__actions">
          {trash.length > 0 && (
            <button className="context-popover__button context-popover__button--danger" onClick={emptyTrash}>
              تفريغ
            </button>
          )}
          <button className="file-explorer__action" onClick={onClose} aria-label="إغلاق السلة">
            <XIcon size={14} />
          </button>
        </div>
      </div>

      {trash.length === 0 ? (
        <p className="trash-drawer__empty">السلة فارغة.</p>
      ) : (
        <div className="trash-drawer__list">
          {trash.map((node) => (
            <div key={node.id} className="trash-drawer__item">
              <span>{node.name}</span>
              <button className="trash-drawer__restore" onClick={() => restoreFile(node.id)}>
                <ArchiveRestoreIcon size={12} />
                استعادة
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const getIconForNode = (node: NodeApi<FileNode>) => {
  if (node.data.type === "folder") {
    return node.isOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />;
  }

  const ext = node.data.name.split(".").pop()?.toLowerCase();
  if (ext === "ts" || ext === "tsx") return <FileCodeIcon size={14} />;
  if (ext === "js" || ext === "jsx") return <FileCodeIcon size={14} />;
  if (ext === "json") return <FileJsonIcon size={14} />;
  if (ext === "md") return <FileTextIcon size={14} />;
  return <FileIcon size={14} />;
};

export default function FileExplorer({ onFileSelect }: FileExplorerProps) {
  const {
    data,
    activeFileId,
    setActiveFile,
    updateFile,
    searchQuery,
    setSearchQuery,
    getFilteredData,
    contextMenu,
    setContextMenu,
    trash,
    softDelete,
    createFolder,
    duplicateFile
  } = useFileSystem();
  const treeRef = useRef<any>(null);
  const [showTrash, setShowTrash] = useState(false);

  const displayData = searchQuery.trim() ? getFilteredData() : data;

  const Node = ({
    node,
    style,
    dragHandle
  }: {
    node: NodeApi<FileNode>;
    style: React.CSSProperties;
    dragHandle?: (element: HTMLDivElement | null) => void;
  }) => {
    const isFolder = node.data.type === "folder";
    const isActive = activeFileId === node.data.id;
    const isLocked = node.data.isLocked;

    return (
      <div
        ref={dragHandle}
        style={style}
        className={`explorer-node ${isActive ? "explorer-node--active" : ""} ${isLocked ? "explorer-node--locked" : ""}`}
        onClick={() => {
          if (isFolder) {
            node.toggle();
            return;
          }
          setActiveFile(node.data.id);
          onFileSelect(node.data);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.data.id });
        }}
      >
        <span className="explorer-node__icon">{getIconForNode(node)}</span>

        {node.isEditing ? (
          <input
            type="text"
            autoFocus
            className="explorer-node__rename"
            defaultValue={node.data.name}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") node.submit(event.currentTarget.value);
              if (event.key === "Escape") node.reset();
            }}
            onBlur={() => node.reset()}
          />
        ) : (
          <span className="explorer-node__label">{node.data.name}</span>
        )}

        {isLocked && <LockIcon size={12} className="explorer-node__lock" />}

        {!node.isEditing && !isLocked && (
          <div className="explorer-node__actions">
            <button
              className="explorer-node__icon-button"
              onClick={(event) => {
                event.stopPropagation();
                node.edit();
              }}
              title="إعادة تسمية"
            >
              <Edit2Icon size={11} />
            </button>
            {!isFolder && (
              <button
                className="explorer-node__icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                  duplicateFile(node.data.id);
                }}
                title="تكرار"
              >
                <CopyIcon size={11} />
              </button>
            )}
            <button
              className="explorer-node__icon-button explorer-node__icon-button--danger"
              onClick={(event) => {
                event.stopPropagation();
                softDelete(node.data.id);
              }}
              title="حذف"
            >
              <Trash2Icon size={11} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="file-explorer">
      <div className="file-explorer__header">
        <div>
          <span className="file-explorer__eyebrow">Workspace</span>
          <h3 className="file-explorer__title">launchpad-studio</h3>
        </div>

        <div className="file-explorer__actions">
          <button
            className="file-explorer__action"
            title="ملف جديد"
            onClick={() => {
              const name = prompt("اسم الملف الجديد؟", "untitled.ts");
              if (name) {
                const ext = name.split(".").pop();
                let lang = "typescript";
                if (ext === "tsx") lang = "typescriptreact";
                if (ext === "py") lang = "python";
                if (ext === "html") lang = "html";
                if (ext === "css") lang = "css";
                if (ext === "json") lang = "json";
                useFileSystem.getState().createFile("root", {
                  name,
                  type: "file",
                  language: lang,
                  content: ""
                });
              }
            }}
          >
            <FilePlusIcon size={14} />
          </button>
          <button
            className="file-explorer__action"
            title="مجلد جديد"
            onClick={() => {
              const name = prompt("اسم المجلد الجديد؟", "new-folder");
              if (name) createFolder("root", name);
            }}
          >
            <FolderPlusIcon size={14} />
          </button>
          <button
            className={`file-explorer__action ${trash.length > 0 ? "file-explorer__action--alert" : ""}`}
            title={`سلة المحذوفات (${trash.length})`}
            onClick={() => setShowTrash(true)}
          >
            <Trash2Icon size={14} />
          </button>
        </div>
      </div>

      <label className="file-explorer__search">
        <SearchIcon size={14} className="file-explorer__search-icon" />
        <input
          className="file-explorer__search-input"
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search files"
        />
        {searchQuery && (
          <button className="file-explorer__search-clear" onClick={() => setSearchQuery("")} type="button">
            <XIcon size={12} />
          </button>
        )}
      </label>

      <div className="file-explorer__tree custom-scrollbar">
        <Tree
          ref={treeRef}
          data={displayData}
          width="100%"
          height={520}
          indent={18}
          rowHeight={34}
          openByDefault
          onMove={({ dragIds, parentId, index }) => {
            if (dragIds[0]) {
              useFileSystem.getState().moveFile(dragIds[0], parentId || null, index);
            }
          }}
          onRename={({ node, name }) => {
            if (name.trim()) {
              updateFile(node.data.id, { name });
            }
          }}
        >
          {Node}
        </Tree>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showTrash && <TrashPanel onClose={() => setShowTrash(false)} />}
    </div>
  );
}
