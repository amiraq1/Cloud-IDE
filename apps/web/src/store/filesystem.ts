import { create } from 'zustand';

export type FileType = 'file' | 'folder';

export interface FileNode {
  id: string;
  name: string;
  type: FileType;
  language?: string;
  content?: string;
  children?: FileNode[];
}

interface FileSystemState {
  data: FileNode[];
  activeFileId: string | null;
  setActiveFile: (id: string) => void;
  setData: (data: FileNode[]) => void;
  createFile: (parentId: string | null, node: Omit<FileNode, 'id'>) => void;
  deleteFile: (id: string) => void;
  updateFile: (id: string, updates: Partial<FileNode>) => void;
  moveFile: (dragId: string, parentId: string | null, index: number) => void;
}

// Initial Mock Data Structure (VFS Schema)
const initialData: FileNode[] = [
  {
    id: "root",
    name: "مشروع السحابة",
    type: "folder",
    children: [
      {
        id: "1",
        name: "main.ts",
        type: "file",
        language: "typescript",
        content: `console.log("Welcome to Cloud IDE Max - Runtime Environment.");\n\nconst time = new Date().toLocaleTimeString('ar-IQ');\nconsole.log(\`التوقيت الحالي للتشغيل: \${time}\`);`
      },
      {
        id: "2",
        name: "scratch.py",
        type: "file",
        language: "python",
        content: `print("Python 3 environment active.")\n\ndef calculate_cloud_speed(factor):\n    return factor * 100\n\nprint("Speed measure:", calculate_cloud_speed(10))`
      },
      {
        id: "src-folder",
        name: "src",
        type: "folder",
        children: [
          {
            id: "3",
            name: "utils.js",
            type: "file",
            language: "javascript",
            content: `export const isAvantGarde = () => true;`
          }
        ]
      }
    ]
  }
];

// Helper to recursively finding/updating
const traverseAndEdit = (nodes: FileNode[], id: string, updater: (node: FileNode) => FileNode | null): FileNode[] => {
  return nodes.map(node => {
    if (node.id === id) {
      const updated = updater(node);
      return updated === null ? null : updated; 
    }
    if (node.children) {
      return { ...node, children: traverseAndEdit(node.children, id, updater).filter(Boolean) as FileNode[] };
    }
    return node;
  }).filter(Boolean) as FileNode[]; // nulls are removed (deleted)
};

export const useFileSystem = create<FileSystemState>((set) => ({
  data: initialData,
  activeFileId: "1",
  
  setActiveFile: (id) => set({ activeFileId: id }),
  
  setData: (data) => set({ data }),
  
  createFile: (parentId, node) => set((state) => {
    const newNode: FileNode = { ...node, id: Math.random().toString(36).substring(7) };
    if (!parentId) {
      return { data: [...state.data, newNode] };
    }
    return {
      data: traverseAndEdit(state.data, parentId, (parent) => ({
        ...parent,
        children: [...(parent.children || []), newNode]
      }))
    };
  }),

  deleteFile: (id) => set((state) => ({
    data: traverseAndEdit(state.data, id, () => null) // Returning null triggers deletion logic in traverseAndEdit
  })),

  updateFile: (id, updates) => set((state) => ({
    data: traverseAndEdit(state.data, id, (node) => ({ ...node, ...updates }))
  })),

  // moveFile logic is often handled by react-arborist directly, but we provide a hook if needed.
  moveFile: (dragId, parentId, index) => set((state) => {
      // In a real VFS, we'd slice the node out and re-insert it at parentId.children[index]
      // react-arborist handle moves natively in its internal uncontrolled state if permitted,
      // but syncing it back to Zustand requires a deep tree restructuring utility.
      // For immediate response, we let Arborist update state.data completely via `setData`.
      return state; 
  })
}));
