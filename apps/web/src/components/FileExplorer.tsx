import React, { useRef } from "react";
import { Tree, NodeApi } from "react-arborist";
import { 
  FolderIcon, 
  FileIcon, 
  ChevronRightIcon, 
  ChevronDownIcon, 
  FileCodeIcon,
  FileJsonIcon,
  Trash2Icon,
  Edit2Icon
} from "lucide-react";
import { useFileSystem, FileNode, FileType } from "../store/filesystem";

interface FileExplorerProps {
  onFileSelect: (file: FileNode) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect }) => {
  const { data, activeFileId, setActiveFile, setData, deleteFile, updateFile } = useFileSystem();
  const treeRef = useRef<any>(null);

  // The rendering of individual nodes in the tree
  const Node = ({ node, style, dragHandle }: { node: NodeApi<FileNode>, style: any, dragHandle?: any }) => {
    const isFolder = node.data.type === "folder";
    const isActive = activeFileId === node.data.id;
    
    // Icon Logic Based On Type and Extension
    const getIcon = () => {
      if (isFolder) {
        return node.isOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />;
      }
      
      const ext = node.data.name.split('.').pop();
      if (ext === 'ts' || ext === 'tsx' || ext === 'js') return <FileCodeIcon size={14} className="text-yellow-500" />;
      if (ext === 'json') return <FileJsonIcon size={14} className="text-green-500" />;
      if (ext === 'py') return <FileCodeIcon size={14} className="text-blue-400" />;
      
      return <FileIcon size={14} className="text-gray-400" />;
    };

    return (
      <div 
        ref={dragHandle} 
        style={style} 
        className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer group transition-colors select-none ${isActive ? 'bg-[#efb13f]/10 text-[#efb13f]' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
        onClick={() => {
          if (isFolder) {
             node.toggle();
          } else {
             setActiveFile(node.data.id);
             onFileSelect(node.data);
          }
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

        {/* Hover Actions (Edit / Delete) */}
        {!isFolder && !node.isEditing && (
           <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); node.edit(); }}
                className="p-1 hover:text-white rounded hover:bg-white/10"
                title="إعادة تسمية"
              >
                <Edit2Icon size={12} />
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if(confirm(`هل أنت متأكد من حذف الملف ${node.data.name}؟`)) {
                    deleteFile(node.data.id);
                  }
                }}
                className="p-1 hover:text-red-400 rounded hover:bg-red-400/10"
                title="حذف"
              >
                <Trash2Icon size={12} />
              </button>
           </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full p-2 overflow-hidden flex flex-col font-sans" dir="rtl">
      {/* VFS Header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
          مستكشف الملفات
        </h3>
        <button 
          className="text-xs text-[#efb13f] hover:text-white transition-colors"
          onClick={() => {
            // Very simplistic new file creation for demonstration
            const name = prompt("اسم الملف الجديد؟", "untitled.ts");
            if (name) {
              const ext = name.split('.').pop();
              let lang = 'typescript';
              if (ext === 'py') lang = 'python';
              if (ext === 'html') lang = 'html';
              
              useFileSystem.getState().createFile('root', {
                name,
                type: 'file',
                language: lang,
                content: '// ملف جديد فارغ'
              });
            }
          }}
        >
          + ملف جديد
        </button>
      </div>

      {/* Arborist Tree Engine */}
      <div className="flex-1 overflow-y-auto w-full custom-scrollbar" dir="ltr">
         {/* We wrap tree in LTR so indentation flows correctly, but keep Arabic names visually right-aligned or neutral */}
        <Tree
          ref={treeRef}
          data={data}
          width="100%"
          height={600} // Virtual scrolling height
          indent={16}
          rowHeight={32}
          openByDefault={false}
          
          // DND Logic
          onMove={({ dragIds, parentId, index }) => {
            // react-arborist generates a new data array internally when nodes move,
            // we will need to update the global Zustand state manually if we want to sync
            // For now, the tree handles basic DnD locally without onChange props
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
    </div>
  );
};

export default FileExplorer;
