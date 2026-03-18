import { create } from 'zustand';

export type FileType = 'file' | 'folder';

export interface FileNode {
  id: string;
  name: string;
  type: FileType;
  language?: string;
  content?: string;
  children?: FileNode[];
  // FILE_SYSTEM_MASTER: Extended Metadata
  size?: number;
  createdAt?: number;
  modifiedAt?: number;
  permissions?: 'read' | 'write' | 'admin';
  isLocked?: boolean;
}

interface FileSystemState {
  data: FileNode[];
  trash: FileNode[];
  activeFileId: string | null;
  searchQuery: string;
  // Context menu state
  contextMenu: { x: number; y: number; nodeId: string } | null;
  // Core Actions  
  setActiveFile: (id: string) => void;
  setData: (data: FileNode[]) => void;
  createFile: (parentId: string | null, node: Omit<FileNode, 'id'>) => void;
  createFolder: (parentId: string | null, name: string) => void;
  deleteFile: (id: string) => void;
  softDelete: (id: string) => void;
  restoreFile: (id: string) => void;
  emptyTrash: () => void;
  updateFile: (id: string, updates: Partial<FileNode>) => void;
  moveFile: (dragId: string, parentId: string | null, index: number) => void;
  duplicateFile: (id: string) => void;
  // Search & Context
  setSearchQuery: (query: string) => void;
  setContextMenu: (menu: { x: number; y: number; nodeId: string } | null) => void;
  // Helpers
  findNode: (nodes: FileNode[], id: string) => FileNode | undefined;
  getFilteredData: () => FileNode[];
}

// Generate unique IDs
const uid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

// Initial Mock Data Structure (VFS Schema)
const initialData: FileNode[] = [
  {
    id: "root",
    name: "launchpad-studio",
    type: "folder",
    createdAt: Date.now(),
    permissions: "admin",
    children: [
      {
        id: "app-entry",
        name: "app.tsx",
        type: "file",
        language: "typescriptreact",
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        content: `export default function App() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Agent workspace</span>
        <h1>Launch your internal operations hub.</h1>
        <p>Realtime data, guided onboarding, and multi-role permissions.</p>
      </section>
    </main>
  );
}`
      },
      {
        id: "theme-file",
        name: "theme.css",
        type: "file",
        language: "css",
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        content: `:root {
  --bg: #0f1115;
  --panel: #161a22;
  --accent: #ff5b1f;
}

body {
  margin: 0;
  background: var(--bg);
  color: #f7f4ef;
  font-family: "IBM Plex Sans Arabic", sans-serif;
}`
      },
      {
        id: "package-file",
        name: "package.json",
        type: "file",
        language: "json",
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        content: `{
  "name": "launchpad-studio",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}`
      },
      {
        id: "src-folder",
        name: "src",
        type: "folder",
        createdAt: Date.now(),
        children: [
          {
            id: "agent-file",
            name: "agent.ts",
            type: "file",
            language: "typescript",
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            content: `export const agentBrief = {
  goal: "Build an operations workspace",
  audience: ["ops", "support", "leadership"],
  status: "ready-for-preview",
};`
          },
          {
            id: "data-file",
            name: "data.ts",
            type: "file",
            language: "typescript",
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            content: `export const metrics = [
  { label: "Active customers", value: 1280 },
  { label: "Escalations", value: 12 },
  { label: "Weekly growth", value: "18%" },
];`
          }
        ]
      },
      {
        id: "notes-file",
        name: "build-notes.md",
        type: "file",
        language: "markdown",
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        content: `# Build notes

- Keep the shell prompt-first.
- Make the editor feel production ready.
- Surface deploy status beside runtime logs.`
      }
    ]
  }
];

// ═══════════════════════════════════════════
// FILE_SYSTEM_MASTER: Tree Traversal Utilities
// ═══════════════════════════════════════════

// Recursively find/update nodes
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

// Recursively find a node by ID
const findNodeRecursive = (nodes: FileNode[], id: string): FileNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeRecursive(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

// Extract node from tree (returns [extractedNode, newTree])
const extractNode = (nodes: FileNode[], id: string): [FileNode | null, FileNode[]] => {
  let extracted: FileNode | null = null;
  const newTree = nodes.map(node => {
    if (node.id === id) {
      extracted = { ...node };
      return null;
    }
    if (node.children) {
      const [childExtracted, newChildren] = extractNode(node.children, id);
      if (childExtracted) extracted = childExtracted;
      return { ...node, children: newChildren };
    }
    return node;
  }).filter(Boolean) as FileNode[];
  return [extracted, newTree];
};

// Insert node into tree at a specific parent
const insertNode = (nodes: FileNode[], parentId: string | null, targetNode: FileNode, index: number): FileNode[] => {
  if (!parentId) {
    const result = [...nodes];
    result.splice(index, 0, targetNode);
    return result;
  }
  return nodes.map(node => {
    if (node.id === parentId && node.children) {
      const newChildren = [...node.children];
      newChildren.splice(index, 0, targetNode);
      return { ...node, children: newChildren };
    }
    if (node.children) {
      return { ...node, children: insertNode(node.children, parentId, targetNode, index) };
    }
    return node;
  });
};

// Filter tree by search query
const filterTree = (nodes: FileNode[], query: string): FileNode[] => {
  if (!query.trim()) return nodes;
  const lowerQuery = query.toLowerCase();
  return nodes.reduce<FileNode[]>((acc, node) => {
    if (node.name.toLowerCase().includes(lowerQuery)) {
      acc.push(node);
    } else if (node.children) {
      const filteredChildren = filterTree(node.children, query);
      if (filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren });
      }
    }
    return acc;
  }, []);
};

// Deep clone a node with new IDs
const deepClone = (node: FileNode): FileNode => {
  const cloned: FileNode = {
    ...node,
    id: uid(),
    name: node.name.replace(/(\.[^.]+)$/, ' - \u0646\u0633\u062E\u0629$1'),
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
  if (node.children) {
    cloned.children = node.children.map(deepClone);
  }
  return cloned;
};

// ═══════════════════════════════════════════
// FILE_SYSTEM_MASTER: Zustand Store
// ═══════════════════════════════════════════

export const useFileSystem = create<FileSystemState>((set, get) => ({
  data: initialData,
  trash: [],
  activeFileId: "app-entry",
  searchQuery: '',
  contextMenu: null,
  
  setActiveFile: (id) => set({ activeFileId: id }),
  
  setData: (data) => set({ data }),
  
  // Create file with auto-detection
  createFile: (parentId, node) => set((state) => {
    const newNode: FileNode = { 
      ...node, 
      id: uid(),
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
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

  // Create folder
  createFolder: (parentId, name) => set((state) => {
    const newFolder: FileNode = {
      id: uid(),
      name,
      type: 'folder',
      children: [],
      createdAt: Date.now(),
      permissions: 'write',
    };
    if (!parentId) {
      return { data: [...state.data, newFolder] };
    }
    return {
      data: traverseAndEdit(state.data, parentId, (parent) => ({
        ...parent,
        children: [...(parent.children || []), newFolder]
      }))
    };
  }),

  // Hard delete (permanent)
  deleteFile: (id) => set((state) => ({
    data: traverseAndEdit(state.data, id, () => null),
    activeFileId: state.activeFileId === id ? null : state.activeFileId,
  })),

  // Soft delete (move to trash)
  softDelete: (id) => set((state) => {
    const node = findNodeRecursive(state.data, id);
    if (!node) return state;
    return {
      data: traverseAndEdit(state.data, id, () => null),
      trash: [...state.trash, { ...node }],
      activeFileId: state.activeFileId === id ? null : state.activeFileId,
    };
  }),

  // Restore from trash
  restoreFile: (id) => set((state) => {
    const node = state.trash.find(n => n.id === id);
    if (!node) return state;
    return {
      data: [...state.data, { ...node }],
      trash: state.trash.filter(n => n.id !== id),
    };
  }),

  // Empty all trash
  emptyTrash: () => set({ trash: [] }),

  // Update file content/metadata  
  updateFile: (id, updates) => set((state) => ({
    data: traverseAndEdit(state.data, id, (node) => ({ 
      ...node, 
      ...updates,
      modifiedAt: Date.now(),
    }))
  })),

  // Move file (real implementation with extract + insert)
  moveFile: (dragId, parentId, index) => set((state) => {
    const [extracted, treeWithout] = extractNode(state.data, dragId);
    if (!extracted) return state;
    return {
      data: insertNode(treeWithout, parentId, extracted, index)
    };
  }),

  // Duplicate file/folder
  duplicateFile: (id) => set((state) => {
    const node = findNodeRecursive(state.data, id);
    if (!node) return state;
    const cloned = deepClone(node);
    // Insert at root level for simplicity
    return { data: [...state.data, cloned] };
  }),

  // Search
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  // Context menu
  setContextMenu: (menu) => set({ contextMenu: menu }),

  // Find node helper (exposed for components)
  findNode: (nodes, id) => findNodeRecursive(nodes, id),

  // Get filtered data based on search query
  getFilteredData: () => {
    const state = get();
    if (!state.searchQuery.trim()) return state.data;
    return filterTree(state.data, state.searchQuery);
  },
}));
