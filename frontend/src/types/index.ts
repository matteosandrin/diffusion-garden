import type { Node, Edge } from "@xyflow/react";

// Block status for AI operations
export type BlockStatus = "idle" | "running" | "success" | "error";

// Model configurations - now strings, actual values come from backend
export type TextModel = string;
export type ImageModel = string;

// Model option for dropdowns
export interface ModelOption {
  id: string;
  label: string;
}

// Models configuration from backend
export interface ModelsConfig {
  textModels: ModelOption[];
  imageModels: ModelOption[];
  defaultTextModel: string;
  defaultImageModel: string;
}

// Text block data
export interface TextBlockData {
  type: "text";
  title: string;
  content: string;
  prompt?: string; // Optional prompt for execution
  model: TextModel;
  status: BlockStatus;
  error?: string;
  generatedBy?: string; // Tool that generated this block
  sourceBlockId?: string; // Parent block ID
  autoRun?: boolean; // If true, execute immediately after creation
  [key: string]: unknown; // Index signature for React Flow compatibility
}

// Image block data
export interface ImageBlockData {
  type: "image";
  title: string;
  imageUrl: string; // URL or base64
  imageId?: string; // Backend image ID
  source: "upload" | "generated";
  model?: ImageModel;
  status: BlockStatus;
  error?: string;
  prompt?: string; // If generated, the prompt used
  sourceBlockId?: string;
  autoRun?: boolean; // If true, generate image immediately after creation
  variation?: boolean; // If true, generate a variation of the image
  [key: string]: unknown; // Index signature for React Flow compatibility
}

// Input content item types
export type InputContentItem =
  | { type: "text"; content: string }
  | { type: "image"; url: string };

export type BlockData = TextBlockData | ImageBlockData;

// Node types for React Flow
export type TextBlockNode = Node<TextBlockData, "textBlock">;
export type ImageBlockNode = Node<ImageBlockData, "imageBlock">;
export type AppNode = TextBlockNode | ImageBlockNode;

// Edge type
export type AppEdge = Edge;

// Canvas state for persistence
export interface CanvasState {
  id: string;
  nodes: AppNode[];
  edges: AppEdge[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Canvas summary for gallery listing
export interface CanvasSummary {
  id: string;
  thumbnailUrl: string | null;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateTextResponse {
  result: string;
}

export interface GenerateImageResponse {
  imageId: string;
  imageUrl: string;
}

// Settings
export interface AppSettings {
  defaultTextModel: string;
  defaultImageModel: string;
  apiKeyStatus: {
    openai: boolean;
    google: boolean;
  };
}

// Prompts
export type Prompts = Record<string, string>;
