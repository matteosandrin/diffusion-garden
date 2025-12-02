import { memo, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  Image,
  ListChevronsUpDown,
  SeparatorHorizontal,
} from 'lucide-react';
import type { TextBlockData, TextModel } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { toolsApi } from '../../api/client';
import { BaseBlockNode } from './BaseBlockNode';
import { BlockToolbarButton } from '../ui/BlockToolbarButton';
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea';
import { splitContent } from '../../utils/splitContent';

function TextBlockNodeComponent({ id, data, selected }: NodeProps) {
  const blockData = data as unknown as TextBlockData;
  const { updateBlockData, updateBlockStatus, addTextBlock, addImageBlock, getInputBlockContent, models } = useCanvasStore();

  const handleContentChange = useCallback(
    (value: string) => {
      updateBlockData(id, { content: value });
    },
    [id, updateBlockData]
  );

  const handlePromptChange = useCallback(
    (value: string) => {
      updateBlockData(id, { prompt: value });
    },
    [id, updateBlockData]
  );

  const handleModelChange = useCallback(
    (model: string) => {
      updateBlockData(id, { model: model as TextModel });
    },
    [id, updateBlockData]
  );

  const handleExpand = useCallback(async () => {
    if (!blockData.content.trim()) return;

    // Get current node position
    const store = useCanvasStore.getState();
    const currentNode = store.nodes.find((n) => n.id === id);
    if (!currentNode) return;

    // Create new text block with prompt
    const newBlockId = addTextBlock(
      {
        x: currentNode.position.x + 350,
        y: currentNode.position.y,
      },
      {
        prompt: store.prompts.expand,
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

  const handleExecute = useCallback(async () => {
    const promptToExecute = blockData.prompt?.trim();
    if (!promptToExecute) return;

    updateBlockStatus(id, 'running');

    try {
      // Get content from connected input blocks
      const inputContentItems = getInputBlockContent(id);
      
      const response = await toolsApi.generateText(promptToExecute, inputContentItems, blockData.model);
      
      // Update content with the result
      updateBlockData(id, { content: response.result });
      updateBlockStatus(id, 'success');
    } catch (error) {
      updateBlockStatus(id, 'error', error instanceof Error ? error.message : 'Failed to execute');
    }
  }, [id, blockData, updateBlockStatus, updateBlockData, getInputBlockContent]);

  const handleGenerateImage = useCallback(() => {
    if (!blockData.content.trim()) return;

    // Get current node position
    const store = useCanvasStore.getState();
    const currentNode = store.nodes.find((n) => n.id === id);
    if (!currentNode) return;

    // Create new image block with prompt
    const newBlockId = addImageBlock(
      {
        x: currentNode.position.x + 350,
        y: currentNode.position.y,
      },
      {
        prompt: blockData.content,
        source: 'generated',
        status: 'idle',
        sourceBlockId: id,
      }
    );

    // Connect text block to image block
    store.onConnect({
      source: id,
      target: newBlockId,
      sourceHandle: null,
      targetHandle: null,
    });
  }, [id, blockData.content, addImageBlock]);

  const handleSplit = useCallback(() => {
    const items = splitContent(blockData.content);
    if (items.length < 2) return;

    // Get current node position
    const store = useCanvasStore.getState();
    const currentNode = store.nodes.find((n) => n.id === id);
    if (!currentNode) return;

    // Create new text blocks for each item, positioned vertically
    items.forEach((item, index) => {
      const i = index - Math.ceil(items.length / 2) + 1;
      const newBlockId = addTextBlock(
        {
          x: currentNode.position.x + 360,
          y: currentNode.position.y + i * 260,
        },
        {
          content: item,
          sourceBlockId: id,
        }
      );

      // Connect source block to new block
      store.onConnect({
        source: id,
        target: newBlockId,
        sourceHandle: null,
        targetHandle: null,
      });
    });
  }, [id, blockData.content, addTextBlock]);

  return (
    <BaseBlockNode
      id={id}
      selected={selected}
      status={blockData.status}
      error={blockData.error}
      accentColor="var(--accent-primary)"
      blockType="text"
      toolbarButtons={
        <>
          <BlockToolbarButton
            onClick={handleExpand}
            disabled={blockData.status === 'running' || !blockData.content.trim()}
            title="Expand"
          >
            <ListChevronsUpDown size={16} />
          </BlockToolbarButton>
          <BlockToolbarButton
            onClick={handleSplit}
            disabled={blockData.status === 'running' || splitContent(blockData.content).length < 2}
            title="Split"
          >
            <SeparatorHorizontal size={16} />
          </BlockToolbarButton>
          <BlockToolbarButton
            onClick={handleGenerateImage}
            disabled={blockData.status === 'running' || !blockData.content.trim()}
            title="Generate image"
          >
            <Image size={16} />
          </BlockToolbarButton>
        </>
      }
      models={models.textModels}
      selectedModel={blockData.model}
      onModelChange={handleModelChange}
      onPlay={handleExecute}
      runButtonDisabled={!blockData.prompt?.trim() && !blockData.content.trim()}
      runButtonTitle="Execute prompt"
      prompt={blockData.prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder="Enter your prompt here..."
    >
      {/* Content section */}
      <div className={`p-3 border-b ${selected ? 'nowheel' : ''}`} style={{ borderColor: 'var(--border-subtle)' }}>
        <AutoResizeTextarea
          value={blockData.content}
          onChange={handleContentChange}
          placeholder="Result will appear here..."
          rows={3}
          style={{ color: 'var(--text-primary)' }}
        />
      </div>
    </BaseBlockNode>
  );
}

export const TextBlockNode = memo(TextBlockNodeComponent);

