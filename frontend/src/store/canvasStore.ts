import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Viewport,
} from "@xyflow/react";
import type {
  AppNode,
  AppEdge,
  TextBlockData,
  ImageBlockData,
  BlockStatus,
  AppSettings,
  Prompts,
  InputContentItem,
  ModelsConfig,
} from "../types";

interface CanvasStore {
  // Canvas state
  canvasId: string | null;
  nodes: AppNode[];
  edges: AppEdge[];
  viewport: Viewport;

  // Selection
  selectedNodeIds: string[];

  // Run queue - nodes that should execute
  nodesToRun: string[];

  // Settings
  settings: AppSettings;

  // Models configuration from backend
  models: ModelsConfig;

  // Prompts
  prompts: Prompts;

  // UI state
  isSaving: boolean;
  lastSaved: Date | null;

  // Context menu state
  contextMenu: {
    x: number;
    y: number;
    flowPosition: { x: number; y: number };
  } | null;
  edgeDropMenu: {
    x: number;
    y: number;
    flowPosition: { x: number; y: number };
    sourceNodeId: string;
  } | null;

  // Pending center - node to center viewport on after creation
  pendingCenterNodeId: string | null;

  defaultBlockSize: { width: number; height: number };

  // Node actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Position helpers
  getViewportCenter: () => { x: number; y: number };
  getBlockPosition: (
    position?: { x: number; y: number },
    upperLeftCorner?: boolean,
  ) => { x: number; y: number };

  // Block CRUD
  addTextBlock: (
    position?: { x: number; y: number },
    data?: Partial<TextBlockData>,
    options?: {
      upperLeftCorner?: boolean;
      centerViewportToBlock?: boolean;
    }
  ) => string;
  addImageBlock: (
    position?: { x: number; y: number },
    data?: Partial<ImageBlockData>,
    options?: {
      upperLeftCorner?: boolean;
      centerViewportToBlock?: boolean;
    }
  ) => string;
  addTextBlockWithEdge: (
    position: { x: number; y: number },
    sourceNodeId: string,
    data?: Partial<TextBlockData>,
  ) => string;
  addImageBlockWithEdge: (
    position: { x: number; y: number },
    sourceNodeId: string,
    data?: Partial<ImageBlockData>,
  ) => string;
  updateBlockData: (
    nodeId: string,
    data: Partial<TextBlockData | ImageBlockData>,
  ) => void;
  updateBlockStatus: (
    nodeId: string,
    status: BlockStatus,
    error?: string,
  ) => void;
  deleteNode: (nodeId: string) => void;
  deleteSelectedNodes: () => void;

  // Selection
  setSelectedNodes: (nodeIds: string[]) => void;
  clearSelection: () => void;

  // Run queue
  requestRunForNodes: (nodeIds: string[]) => void;
  clearNodeFromRunQueue: (nodeId: string) => void;

  // Viewport
  setViewport: (viewport: Viewport) => void;

  // Settings
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Models
  setModels: (models: ModelsConfig) => void;

  // Prompts
  setPrompts: (prompts: Prompts) => void;

  // Canvas management
  setCanvasId: (id: string) => void;
  loadCanvas: (nodes: AppNode[], edges: AppEdge[], viewport?: Viewport) => void;
  setSaving: (isSaving: boolean) => void;
  setLastSaved: (date: Date) => void;

  // Context menu actions
  setContextMenu: (menu: CanvasStore["contextMenu"]) => void;
  setEdgeDropMenu: (menu: CanvasStore["edgeDropMenu"]) => void;
  closeMenus: () => void;

  // Centering
  setPendingCenterNodeId: (nodeId: string | null) => void;

  // Helper to check for cycles
  wouldCreateCycle: (source: string, target: string) => boolean;

  // Get ancestors and descendants for lineage highlighting
  getLineage: (nodeId: string) => {
    ancestors: string[];
    descendants: string[];
  };

  // Get input blocks (blocks that connect TO this block)
  getInputBlocks: (nodeId: string) => AppNode[];

  // Get content from all input blocks as typed array
  getInputBlockContent: (nodeId: string) => InputContentItem[];
}

const BLOCK_WIDTH = 280;
const BLOCK_HEIGHT = 280;

// Helper to generate unique IDs
const generateId = () =>
  `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useCanvasStore = create<CanvasStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    canvasId: null,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeIds: [],
    nodesToRun: [],
    settings: {
      defaultTextModel: "",
      defaultImageModel: "",
      apiKeyStatus: {
        openai: false,
        google: false,
      },
    },
    models: {
      textModels: [],
      imageModels: [],
      defaultTextModel: "",
      defaultImageModel: "",
    },
    prompts: {},
    isSaving: false,
    lastSaved: null,
    contextMenu: null,
    edgeDropMenu: null,
    pendingCenterNodeId: null,
    defaultBlockSize: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT },

    // React Flow change handlers
    onNodesChange: (changes) => {
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes) as AppNode[],
      }));
    },

    onEdgesChange: (changes) => {
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      }));
    },

    onConnect: (connection) => {
      const { source, target } = connection;
      if (!source || !target) return;

      // Check for cycles
      if (get().wouldCreateCycle(source, target)) {
        console.warn("Connection would create a cycle");
        return;
      }

      const newEdge: AppEdge = {
        id: `edge-${source}-${target}`,
        source,
        target,
        type: "animated",
      };

      set((state) => ({
        edges: [...state.edges, newEdge],
      }));
    },

    // Position helpers
    getViewportCenter: () => {
      const { viewport } = get();
      // Convert screen center to flow coordinates
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      return { x: centerX, y: centerY };
    },

    getBlockPosition: (position, upperLeftCorner = false) => {
      const referencePosition = position || get().getViewportCenter();
      return upperLeftCorner
        ? referencePosition
        : {
            x: referencePosition.x - BLOCK_WIDTH / 2,
            y: referencePosition.y - BLOCK_HEIGHT / 2,
          };
    },

    addTextBlock: (position, data, { upperLeftCorner = false, centerViewportToBlock = true } = {}) => {
      const id = generateId();
      const { settings, getBlockPosition } = get();
      const blockPosition = getBlockPosition(position, upperLeftCorner);

      const newNode: AppNode = {
        id,
        type: "textBlock",
        position: blockPosition,
        selected: true,
        data: {
          type: "text",
          title: data?.title || "",
          content: data?.content || "",
          model: data?.model || settings.defaultTextModel,
          status: "idle",
          ...data,
        } as TextBlockData,
      };

      set((state) => ({
        nodes: [
          ...state.nodes.map((n) => ({ ...n, selected: false })),
          newNode,
        ],
        selectedNodeIds: [id],
        pendingCenterNodeId: centerViewportToBlock ? id : null,
      }));

      return id;
    },

    addImageBlock: (position, data, { upperLeftCorner = false, centerViewportToBlock = true } = {}) => {
      const id = generateId();
      const { settings, getBlockPosition } = get();
      const blockPosition = getBlockPosition(position, upperLeftCorner);

      const newNode: AppNode = {
        id,
        type: "imageBlock",
        position: blockPosition,
        selected: true,
        data: {
          type: "image",
          title: data?.title || "",
          imageUrl: data?.imageUrl || "",
          source: data?.source || "upload",
          model: settings.defaultImageModel,
          status: "idle",
          ...data,
        } as ImageBlockData,
      };

      set((state) => ({
        nodes: [
          ...state.nodes.map((n) => ({ ...n, selected: false })),
          newNode,
        ],
        selectedNodeIds: [id],
        pendingCenterNodeId: centerViewportToBlock ? id : null,
      }));

      return id;
    },

    addTextBlockWithEdge: (position, sourceNodeId, data) => {
      const id = get().addTextBlock(position, data);
      const newEdge: AppEdge = {
        id: `edge-${sourceNodeId}-${id}`,
        source: sourceNodeId,
        target: id,
        type: "animated",
      };

      set((state) => ({
        edges: [...state.edges, newEdge],
        selectedNodeIds: [id],
      }));

      return id;
    },

    addImageBlockWithEdge: (position, sourceNodeId, data) => {
      const id = get().addImageBlock(position, data);
      const newEdge: AppEdge = {
        id: `edge-${sourceNodeId}-${id}`,
        source: sourceNodeId,
        target: id,
        type: "animated",
      };

      set((state) => ({
        edges: [...state.edges, newEdge],
        selectedNodeIds: [id],
      }));

      return id;
    },

    updateBlockData: (nodeId, data) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node,
        ) as AppNode[],
      }));
    },

    updateBlockStatus: (nodeId, status, error) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, status, error } }
            : node,
        ) as AppNode[],
      }));
    },

    deleteNode: (nodeId) => {
      set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        edges: state.edges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
        selectedNodeIds: state.selectedNodeIds.filter((id) => id !== nodeId),
      }));
    },

    deleteSelectedNodes: () => {
      const { selectedNodeIds } = get();
      if (selectedNodeIds.length === 0) return;

      set((state) => ({
        nodes: state.nodes.filter((node) => !selectedNodeIds.includes(node.id)),
        edges: state.edges.filter(
          (edge) =>
            !selectedNodeIds.includes(edge.source) &&
            !selectedNodeIds.includes(edge.target),
        ),
        selectedNodeIds: [],
      }));
    },

    // Selection
    setSelectedNodes: (nodeIds) => {
      set({ selectedNodeIds: nodeIds });
    },

    clearSelection: () => {
      set({ selectedNodeIds: [] });
    },

    // Run queue
    requestRunForNodes: (nodeIds) => {
      set({ nodesToRun: nodeIds });
    },

    clearNodeFromRunQueue: (nodeId) => {
      set((state) => ({
        nodesToRun: state.nodesToRun.filter((id) => id !== nodeId),
      }));
    },

    // Viewport
    setViewport: (viewport) => {
      set({ viewport });
    },

    // Settings
    updateSettings: (newSettings) => {
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
      }));
    },

    // Models
    setModels: (models) => {
      set({
        models,
        settings: {
          ...get().settings,
          defaultTextModel: models.defaultTextModel,
          defaultImageModel: models.defaultImageModel,
        },
      });
    },

    // Prompts
    setPrompts: (prompts) => {
      set({ prompts });
    },

    // Canvas management
    setCanvasId: (id) => {
      set({ canvasId: id });
    },

    loadCanvas: (nodes, edges, viewport) => {
      set({
        nodes,
        edges,
        viewport: viewport || { x: 0, y: 0, zoom: 1 },
      });
    },

    setSaving: (isSaving) => {
      set({ isSaving });
    },

    setLastSaved: (date) => {
      set({ lastSaved: date });
    },

    setContextMenu: (menu) => {
      set({ contextMenu: menu });
    },

    setEdgeDropMenu: (menu) => {
      set({ edgeDropMenu: menu });
    },

    closeMenus: () => {
      set({ contextMenu: null, edgeDropMenu: null });
    },

    setPendingCenterNodeId: (nodeId) => {
      set({ pendingCenterNodeId: nodeId });
    },

    // Cycle detection using DFS
    wouldCreateCycle: (source, target) => {
      const { edges } = get();

      // Build adjacency list including the proposed new edge
      const adjacency = new Map<string, string[]>();

      // Add existing edges
      edges.forEach((edge) => {
        const sources = adjacency.get(edge.source) || [];
        sources.push(edge.target);
        adjacency.set(edge.source, sources);
      });

      // Add the proposed edge
      const sources = adjacency.get(source) || [];
      sources.push(target);
      adjacency.set(source, sources);

      // DFS to detect cycle
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const hasCycle = (node: string): boolean => {
        visited.add(node);
        recursionStack.add(node);

        const neighbors = adjacency.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (hasCycle(neighbor)) return true;
          } else if (recursionStack.has(neighbor)) {
            return true;
          }
        }

        recursionStack.delete(node);
        return false;
      };

      // Check all nodes
      for (const node of adjacency.keys()) {
        if (!visited.has(node)) {
          if (hasCycle(node)) return true;
        }
      }

      return false;
    },

    // Lineage tracking
    getLineage: (nodeId) => {
      const { edges } = get();

      // Build both forward and reverse adjacency lists
      const forward = new Map<string, string[]>();
      const backward = new Map<string, string[]>();

      edges.forEach((edge) => {
        // Forward: source -> targets
        const fwd = forward.get(edge.source) || [];
        fwd.push(edge.target);
        forward.set(edge.source, fwd);

        // Backward: target -> sources
        const bwd = backward.get(edge.target) || [];
        bwd.push(edge.source);
        backward.set(edge.target, bwd);
      });

      // Find all ancestors (BFS backward)
      const ancestors = new Set<string>();
      const ancestorQueue = [nodeId];
      while (ancestorQueue.length > 0) {
        const current = ancestorQueue.shift()!;
        const parents = backward.get(current) || [];
        for (const parent of parents) {
          if (!ancestors.has(parent)) {
            ancestors.add(parent);
            ancestorQueue.push(parent);
          }
        }
      }

      // Find all descendants (BFS forward)
      const descendants = new Set<string>();
      const descendantQueue = [nodeId];
      while (descendantQueue.length > 0) {
        const current = descendantQueue.shift()!;
        const children = forward.get(current) || [];
        for (const child of children) {
          if (!descendants.has(child)) {
            descendants.add(child);
            descendantQueue.push(child);
          }
        }
      }

      return {
        ancestors: Array.from(ancestors),
        descendants: Array.from(descendants),
      };
    },

    // Get input blocks (blocks that connect TO this block)
    getInputBlocks: (nodeId) => {
      const { edges, nodes } = get();

      // Find all edges where this node is the target
      const inputEdgeSources = edges
        .filter((edge) => edge.target === nodeId)
        .map((edge) => edge.source);

      // Find corresponding nodes
      return nodes.filter((node) => inputEdgeSources.includes(node.id));
    },

    // Get content from all input blocks as typed array
    getInputBlockContent: (nodeId) => {
      const inputBlocks = get().getInputBlocks(nodeId);

      if (inputBlocks.length === 0) {
        return [];
      }

      const contentItems: InputContentItem[] = [];

      for (const block of inputBlocks) {
        if (block.data.type === "text") {
          const textData = block.data as TextBlockData;
          if (textData.content.trim()) {
            contentItems.push({
              type: "text",
              content: textData.content.trim(),
            });
          }
        } else if (block.data.type === "image") {
          const imageData = block.data as ImageBlockData;
          if (imageData.imageUrl) {
            contentItems.push({
              type: "image",
              url: imageData.imageUrl,
            });
          }
        }
      }

      return contentItems;
    },
  })),
);
