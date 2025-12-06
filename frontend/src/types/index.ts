import type { Node, Edge } from "@xyflow/react";

export type BlockStatus = "idle" | "running" | "uploading" | "success" | "error";

export type TextModel = string;
export type ImageModel = string;

export interface ModelOption {
  id: string;
  label: string;
}

export interface ModelsConfig {
  textModels: ModelOption[];
  imageModels: ModelOption[];
  defaultTextModel: string;
  defaultImageModel: string;
}

export interface BlockData {
  title: string;
  status: BlockStatus;
  error?: string;
  prompt?: string;
  sourceBlockId?: string;
  autoRun?: boolean; // If true, run immediately after creation
  [key: string]: unknown; // Index signature for React Flow compatibility
}

export interface TextBlockData extends BlockData {
  type: "text";
  content: string;
  model: TextModel;
  generatedBy?: string; // Tool that generated this block
}

export interface ImageBlockData extends BlockData {
  type: "image";
  imageUrl: string; // URL or base64
  imageId?: string;
  source: "upload" | "generated";
  model?: ImageModel;
  variation?: boolean; // If true, generate a variation of the image
}

export type InputContentItem =
  | { type: "text"; content: string }
  | { type: "image"; url: string };

export type TextBlockNode = Node<TextBlockData, "textBlock">;
export type ImageBlockNode = Node<ImageBlockData, "imageBlock">;
export type AppNode = TextBlockNode | ImageBlockNode;

export type AppEdge = Edge;

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

export interface AppSettings {
  defaultTextModel: string;
  defaultImageModel: string;
  apiKeyStatus: {
    openai: boolean;
    google: boolean;
  };
}

export type Prompts = Record<string, string>;
