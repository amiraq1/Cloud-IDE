import React from "react";
import { ChevronLeftIcon, FolderIcon, FileIcon } from "lucide-react";
import { useFileSystem, FileNode } from "../store/filesystem";

// ═══════════════════════════════════════════
// BREADCRUMB_ELITE: Path Navigation Component
// ═══════════════════════════════════════════

interface BreadcrumbProps {
  fileId: string | null;
}

// Build the path from root to the target node
const buildPath = (nodes: FileNode[], targetId: string): FileNode[] => {
  for (const node of nodes) {
    if (node.id === targetId) return [node];
    if (node.children) {
      const childPath = buildPath(node.children, targetId);
      if (childPath.length > 0) return [node, ...childPath];
    }
  }
  return [];
};

const Breadcrumb: React.FC<BreadcrumbProps> = ({ fileId }) => {
  const { data, setActiveFile } = useFileSystem();

  if (!fileId) {
    return (
      <div className="breadcrumb-bar">
        <span className="breadcrumb-bar__empty">مساحة العمل</span>
      </div>
    );
  }

  const path = buildPath(data, fileId);

  return (
    <nav className="breadcrumb-bar" aria-label="مسار الملف">
      {path.map((node, idx) => {
        const isLast = idx === path.length - 1;
        const isFolder = node.type === "folder";

        return (
          <React.Fragment key={node.id}>
            <button
              className={`breadcrumb-item ${isLast ? "breadcrumb-item--current" : ""}`}
              onClick={() => {
                if (!isFolder) setActiveFile(node.id);
              }}
              aria-current={isLast ? "page" : undefined}
            >
              <span className="breadcrumb-item__icon">
                {isFolder ? (
                  <FolderIcon size={12} />
                ) : (
                  <FileIcon size={12} />
                )}
              </span>
              <span dir="auto">{node.name}</span>
            </button>

            {!isLast && (
              <ChevronLeftIcon
                size={11}
                className="breadcrumb-separator"
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
