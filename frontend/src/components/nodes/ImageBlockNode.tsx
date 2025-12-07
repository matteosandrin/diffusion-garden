import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  FileText,
  Upload,
  X,
} from 'lucide-react';
import type { ImageBlockData } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { toolsApi, imageApi } from '../../api/client';
import { BaseBlockNode } from './BaseBlockNode';

function ImageBlockNodeComponent({ id, data, selected }: NodeProps) {
  const blockData = data as unknown as ImageBlockData;
  const { updateBlockData, updateBlockStatus, addTextBlock, getInputBlocks, getInputBlockContent } = useCanvasStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptFromInputRef = useRef(false);
  const lastInputContentRef = useRef<string>('');

  // Get input blocks and their content
  const inputBlocks = getInputBlocks(id);
  const inputContent = inputBlocks.length > 0 ? getInputBlockContent(id).trim() : '';
  const hasInputBlocks = inputBlocks.length > 0;

  // Monitor input blocks and update prompt accordingly
  useEffect(() => {
    if (hasInputBlocks) {
      // Only update if the input content actually changed
      if (inputContent !== lastInputContentRef.current) {
        updateBlockData(id, { prompt: inputContent });
        lastInputContentRef.current = inputContent;
        promptFromInputRef.current = true;
      }
    } else {
      // No input blocks - clear prompt if it was from input
      if (promptFromInputRef.current) {
        updateBlockData(id, { prompt: '' });
        promptFromInputRef.current = false;
        lastInputContentRef.current = '';
      }
    }
  }, [id, hasInputBlocks, inputContent, updateBlockData]);

  // Determine if prompt is from input blocks
  const promptFromInput = getInputBlocks(id).length > 0;

  const handlePromptChange = useCallback(
    (value: string) => {
      // Only allow manual changes if prompt is not from input blocks
      const hasInputBlocks = getInputBlocks(id).length > 0;
      if (!hasInputBlocks) {
        updateBlockData(id, { prompt: value });
        promptFromInputRef.current = false;
      }
    },
    [id, updateBlockData, getInputBlocks]
  );

  const handleGenerate = useCallback(async () => {
    if (!blockData.prompt?.trim()) return;

    updateBlockStatus(id, 'running');
    
    try {
      const response = await toolsApi.generate(blockData.prompt);
      updateBlockData(id, {
        imageUrl: response.imageUrl,
        imageId: response.imageId,
        source: 'generated',
      });
      updateBlockStatus(id, 'success');
    } catch (error) {
      updateBlockStatus(id, 'error', error instanceof Error ? error.message : 'Failed to generate image');
    }
  }, [id, blockData.prompt, updateBlockStatus, updateBlockData]);

  const handleDescribe = useCallback(async () => {
    if (!blockData.imageUrl) return;

    updateBlockStatus(id, 'running');

    try {
      // Fetch image and convert to base64
      let imageBase64 = blockData.imageUrl;
      
      if (!imageBase64.startsWith('data:')) {
        const response = await fetch(blockData.imageUrl);
        const blob = await response.blob();
        imageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const result = await toolsApi.describe(imageBase64);

      // Create new text block with description
      const store = useCanvasStore.getState();
      const currentNode = store.nodes.find((n) => n.id === id);
      if (!currentNode) return;

      const newBlockId = addTextBlock(
        {
          x: currentNode.position.x + 350,
          y: currentNode.position.y,
        },
        {
          content: result.description,
          generatedBy: 'describe',
          sourceBlockId: id,
        }
      );

      // Add edge
      store.onConnect({
        source: id,
        target: newBlockId,
        sourceHandle: null,
        targetHandle: null,
      });

      updateBlockStatus(id, 'success');
    } catch (error) {
      updateBlockStatus(id, 'error', error instanceof Error ? error.message : 'Failed to describe');
    }
  }, [id, blockData, updateBlockStatus, addTextBlock]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        updateBlockStatus(id, 'error', 'Please upload an image file');
        return;
      }

      updateBlockStatus(id, 'running');

      try {
        const result = await imageApi.upload(file);
        updateBlockData(id, {
          imageUrl: result.imageUrl,
          imageId: result.imageId,
          source: 'upload',
        });
        updateBlockStatus(id, 'success');
      } catch (error) {
        updateBlockStatus(id, 'error', error instanceof Error ? error.message : 'Upload failed');
      }
    },
    [id, updateBlockData, updateBlockStatus]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  return (
    <>
      <BaseBlockNode
        id={id}
        selected={selected}
        status={blockData.status}
        error={blockData.error}
        accentColor="var(--accent-secondary)"
        glowShadow="0 0 30px rgba(236, 72, 153, 0.3)"
        blockType="image"
        toolbarButtons={
          blockData.imageUrl ? (
            <button
              onClick={handleDescribe}
              disabled={blockData.status === 'running'}
              className="p-1.5 rounded transition-all disabled:opacity-50 hover:bg-opacity-80"
              style={{
                background: blockData.status === 'running' ? 'transparent' : 'var(--accent-primary)',
                color: 'white',
              }}
              title="Describe this image"
            >
              <FileText size={16} />
            </button>
          ) : null
        }
        onPlay={handleGenerate}
        runButtonDisabled={!blockData.prompt?.trim()}
        runButtonTitle="Generate image"
        prompt={blockData.prompt}
        onPromptChange={handlePromptChange}
        promptPlaceholder="Enter image generation prompt here..."
        promptReadonly={promptFromInput}
      >
        {/* Image content */}
        <div
          className="p-3"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {blockData.imageUrl ? (
            <div className="relative group">
              <img
                src={blockData.imageUrl}
                alt={blockData.title || 'Block image'}
                className="w-full rounded-lg cursor-pointer"
                onClick={() => setIsModalOpen(true)}
              />
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors"
              style={{
                borderColor: isDragOver ? 'var(--accent-secondary)' : 'var(--border-default)',
                background: isDragOver ? 'rgba(236, 72, 153, 0.1)' : 'var(--bg-elevated)',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload
                size={24}
                style={{ color: isDragOver ? 'var(--accent-secondary)' : 'var(--text-muted)' }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          )}
        </div>
      </BaseBlockNode>

      {/* Image Modal */}
      {isModalOpen && blockData.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setIsModalOpen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
            }}
            onClick={() => setIsModalOpen(false)}
          >
            <X size={24} />
          </button>
          <img
            src={blockData.imageUrl}
            alt={blockData.title || 'Full size image'}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

export const ImageBlockNode = memo(ImageBlockNodeComponent);

