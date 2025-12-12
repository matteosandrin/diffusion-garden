import type { Node, Edge } from '@xyflow/react';

// Block status for AI operations
export type BlockStatus = 'idle' | 'running' | 'success' | 'error';

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
  type: 'text';
  title: string;
  content: string;
  prompt?: string; // Optional prompt for execution
  model: TextModel;
  status: BlockStatus;
  error?: string;
  generatedBy?: string; // Tool that generated this block
  sourceBlockId?: string; // Parent block ID
  [key: string]: unknown; // Index signature for React Flow compatibility
}

// Image block data
export interface ImageBlockData {
  type: 'image';
  title: string;
  imageUrl: string; // URL or base64
  imageId?: string; // Backend image ID
  source: 'upload' | 'generated';
  model?: ImageModel;
  status: BlockStatus;
  error?: string;
  prompt?: string; // If generated, the prompt used
  sourceBlockId?: string;
  [key: string]: unknown; // Index signature for React Flow compatibility
}

// Input content item types
export type InputContentItem =
  | { type: 'text'; content: string }
  | { type: 'image'; url: string };

export type BlockData = TextBlockData | ImageBlockData;

// Node types for React Flow
export type TextBlockNode = Node<TextBlockData, 'textBlock'>;
export type ImageBlockNode = Node<ImageBlockData, 'imageBlock'>;
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
