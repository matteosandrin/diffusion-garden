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
import { imageApi } from "../api/client";

interface CanvasStore {
  canvasId: string | null;
  nodes: AppNode[];
  edges: AppEdge[];
  viewport: Viewport;
  selectedNodeIds: string[];

  // Run queue is used to implement the execution of nodes in parallel
  nodesToRun: string[];
  settings: AppSettings;
  models: ModelsConfig;
  prompts: Prompts;
  isSaving: boolean;
  lastSaved: Date | null;
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
  pendingCenterNodeId: string | null;
  defaultBlockSize: { width: number; height: number };

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  getViewportCenter: () => { x: number; y: number };
  getBlockPosition: (
    position?: { x: number; y: number },
    upperLeftCorner?: boolean,
  ) => { x: number; y: number };
  addTextBlock: (
    position?: { x: number; y: number },
    data?: Partial<TextBlockData>,
    options?: {
      upperLeftCorner?: boolean;
      centerViewportToBlock?: boolean;
    },
  ) => string;
  addImageBlock: (
    position?: { x: number; y: number },
    data?: Partial<ImageBlockData>,
    options?: {
      upperLeftCorner?: boolean;
      centerViewportToBlock?: boolean;
    },
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
  setSelectedNodes: (nodeIds: string[]) => void;
  clearSelection: () => void;
  requestRunForNodes: (nodeIds: string[]) => void;
  clearNodeFromRunQueue: (nodeId: string) => void;
  setViewport: (viewport: Viewport) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setModels: (models: ModelsConfig) => void;
  setPrompts: (prompts: Prompts) => void;
  setCanvasId: (id: string) => void;
  loadCanvas: (nodes: AppNode[], edges: AppEdge[], viewport?: Viewport) => void;
  setSaving: (isSaving: boolean) => void;
  setLastSaved: (date: Date) => void;
  setContextMenu: (menu: CanvasStore["contextMenu"]) => void;
  setEdgeDropMenu: (menu: CanvasStore["edgeDropMenu"]) => void;
  closeMenus: () => void;
  setPendingCenterNodeId: (nodeId: string | null) => void;
  getInputBlocks: (nodeId: string) => AppNode[];
  getInputBlockContent: (nodeId: string) => InputContentItem[];
}

const BLOCK_WIDTH = 280;
const BLOCK_HEIGHT = 280;
export const GRID_SIZE = 20;

const snapToGrid = (position: { x: number; y: number }) => ({
  x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(position.y / GRID_SIZE) * GRID_SIZE,
});

const generateId = () =>
  `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useCanvasStore = create<CanvasStore>()(
  subscribeWithSelector((set, get) => ({
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

    getViewportCenter: () => {
      const { viewport } = get();
      // Translate screen center to react-flow viewport center
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      return { x: centerX, y: centerY };
    },

    getBlockPosition: (position, upperLeftCorner = false) => {
      const referencePosition = position || get().getViewportCenter();
      const blockPosition = upperLeftCorner
        ? referencePosition
        : {
            x: referencePosition.x - BLOCK_WIDTH / 2,
            y: referencePosition.y - BLOCK_HEIGHT / 2,
          };
      return snapToGrid(blockPosition);
    },

    addTextBlock: (
      position,
      data,
      { upperLeftCorner = false, centerViewportToBlock = true } = {},
    ) => {
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

    addImageBlock: (
      position,
      data,
      { upperLeftCorner = false, centerViewportToBlock = true } = {},
    ) => {
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

    deleteNode: async (nodeId) => {
      const { nodes } = get();
      const node = nodes.find((node) => node.id === nodeId);
      if (!node) return;
      if (node.data.type === "image") {
        const imageUrl = node.data.imageUrl as string;
        const imageFilename = imageUrl.split("/").pop() ?? "";
        if (imageFilename) {
          try {
            const response = await imageApi.delete(imageFilename);
            if (!response.success) {
              console.error("Failed to delete image", response);
            }
          } catch (error) {
            console.error("Failed to delete image:", error);
          }
        }
      }
      set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        edges: state.edges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
        selectedNodeIds: state.selectedNodeIds.filter((id) => id !== nodeId),
      }));
    },

    deleteSelectedNodes: () => {
      const { selectedNodeIds, deleteNode } = get();
      if (selectedNodeIds.length === 0) return;
      selectedNodeIds.forEach((nodeId) => {
        deleteNode(nodeId);
      });
    },

    setSelectedNodes: (nodeIds) => {
      set({ selectedNodeIds: nodeIds });
    },

    clearSelection: () => {
      set({ selectedNodeIds: [] });
    },

    requestRunForNodes: (nodeIds) => {
      set({ nodesToRun: nodeIds });
    },

    clearNodeFromRunQueue: (nodeId) => {
      set((state) => ({
        nodesToRun: state.nodesToRun.filter((id) => id !== nodeId),
      }));
    },

    setViewport: (viewport) => {
      set({ viewport });
    },

    updateSettings: (newSettings) => {
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
      }));
    },

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

    setPrompts: (prompts) => {
      set({ prompts });
    },

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

    getInputBlocks: (nodeId) => {
      const { edges, nodes } = get();

      // Find all edges where this node is the target
      const inputEdgeSources = edges
        .filter((edge) => edge.target === nodeId)
        .map((edge) => edge.source);

      return nodes.filter((node) => inputEdgeSources.includes(node.id));
    },

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
