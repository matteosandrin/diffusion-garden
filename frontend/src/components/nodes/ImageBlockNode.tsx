import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  PilcrowRight,
  Upload,
} from 'lucide-react';
import type { ImageBlockData, ImageModel } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { toolsApi, imageApi } from '../../api/client';
import { BaseBlockNode } from './BaseBlockNode';
import { BlockToolbarButton } from '../ui/BlockToolbarButton';

function ImageBlockNodeComponent({ id, data, selected }: NodeProps) {
  const blockData = data as unknown as ImageBlockData;
  const { updateBlockData, updateBlockStatus, addTextBlock, getInputBlockContent, models } = useCanvasStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptFromInputRef = useRef(false);
  const lastInputContentRef = useRef<string>('');

  // Get input blocks and their content
  const inputContentItems = getInputBlockContent(id);
  // Convert array to string: extract text content and join with newlines
  const inputContent = inputContentItems.length > 0
    ? inputContentItems
        .filter(item => item.type === 'text')
        .map(item => item.content)
        .join('\n\n')
        .trim()
    : '';

  // Monitor input blocks and update prompt accordingly
  useEffect(() => {
    const hasTextualInput = inputContentItems.some(item => item.type === 'text');
    if (hasTextualInput) {
      // Only update if the input content actually changed
      if (inputContent !== lastInputContentRef.current) {
        updateBlockData(id, { prompt: inputContent });
        lastInputContentRef.current = inputContent;
        promptFromInputRef.current = true;
      }
    } else {
      // No textual input blocks - clear prompt if it was from input
      if (promptFromInputRef.current) {
        updateBlockData(id, { prompt: '' });
        promptFromInputRef.current = false;
        lastInputContentRef.current = '';
      }
    }
  }, [id, inputContentItems, inputContent, updateBlockData]);

  // Determine if prompt is from textual input blocks
  const promptFromInput = inputContentItems.some(item => item.type === 'text');

  const handlePromptChange = useCallback(
    (value: string) => {
      // Only allow manual changes if prompt is not from textual input blocks
      const hasTextualInput = inputContentItems.some(item => item.type === 'text');
      if (!hasTextualInput) {
        updateBlockData(id, { prompt: value });
        promptFromInputRef.current = false;
      }
    },
    [id, inputContentItems, updateBlockData]
  );

  const handleModelChange = useCallback(
    (model: string) => {
      updateBlockData(id, { model: model as ImageModel });
    },
    [id, updateBlockData]
  );

  const handleGenerate = useCallback(async () => {
    if (!blockData.prompt?.trim()) return;

    updateBlockStatus(id, 'running');
    
    try {
      const response = await toolsApi.generateImage(blockData.prompt, inputContentItems, blockData.model as ImageModel);
      updateBlockData(id, {
        imageUrl: response.imageUrl,
        imageId: response.imageId,
        source: 'generated',
      });
      updateBlockStatus(id, 'success');
    } catch (error) {
      updateBlockStatus(id, 'error', error instanceof Error ? error.message : 'Failed to generate image');
    }
  }, [id, blockData.prompt, inputContentItems, updateBlockStatus, updateBlockData]);

  const handleDescribe = useCallback(async () => {
    if (!blockData.imageUrl) return;

    // Get current node position
    const store = useCanvasStore.getState();
    const currentNode = store.nodes.find((n) => n.id === id);
    if (!currentNode) return;

    const currentNodeWidth = currentNode.width || 280;

    // Create new text block with prompt
    const newBlockId = addTextBlock(
      {
        x: currentNode.position.x + currentNodeWidth + 60,
        y: currentNode.position.y,
      },
      {
        prompt: store.prompts.describe,
        sourceBlockId: id,
      }
    );

    // Connect current text block to new text block
    store.onConnect({
      source: id,
      target: newBlockId,
      sourceHandle: null,
      targetHandle: null,
    });
   
  }, [id, blockData.content, addTextBlock]);

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
        accentColor="var(--accent-primary)"
        blockType="image"
        toolbarButtons={
          <BlockToolbarButton
            onClick={handleDescribe}
            disabled={blockData.status === 'running' || !blockData.imageUrl}
            title="Describe"
          >
            <PilcrowRight size={16} />
          </BlockToolbarButton>
        }
        onPlay={handleGenerate}
        runButtonDisabled={!blockData.prompt?.trim()}
        runButtonTitle="Generate image"
        prompt={blockData.prompt}
        onPromptChange={handlePromptChange}
        promptPlaceholder="Enter image generation prompt here..."
        promptReadonly={promptFromInput}
        models={models.imageModels}
        selectedModel={blockData.model || models.defaultImageModel}
        onModelChange={handleModelChange}
      >
        {/* Image content */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {blockData.imageUrl ? (
            <div className="relative group">
              <img
                src={blockData.imageUrl}
                alt={blockData.title || 'Block image'}
                className="w-full cursor-pointer"
              />
            </div>
          ) : (
            <div className="p-3">
              <div
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors"
                style={{
                  borderColor: isDragOver ? 'var(--accent-secondary)' : 'var(--border-default)',
                  background: isDragOver ? 'rgba(255, 255, 255, 0.1)' : 'var(--bg-elevated)',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload
                  size={24}
                  style={{ color: isDragOver ? 'var(--text-primary)' : 'var(--text-muted)' }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>
      </BaseBlockNode>
    </>
  );
}

export const ImageBlockNode = memo(ImageBlockNodeComponent);

