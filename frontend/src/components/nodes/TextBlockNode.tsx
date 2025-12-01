import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Type,
  Sparkles,
  Image,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import type { TextBlockData, TextModel } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { toolsApi } from '../../api/client';

const TEXT_MODELS: { value: TextModel; label: string }[] = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

function TextBlockNodeComponent({ id, data, selected }: NodeProps) {
  const blockData = data as unknown as TextBlockData;
  const { updateBlockData, updateBlockStatus, addTextBlock, addImageBlock } = useCanvasStore();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [blockData.content]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateBlockData(id, { title: e.target.value });
    },
    [id, updateBlockData]
  );

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateBlockData(id, { content: e.target.value });
    },
    [id, updateBlockData]
  );

  const handleModelChange = useCallback(
    (model: TextModel) => {
      updateBlockData(id, { model });
      setIsModelDropdownOpen(false);
    },
    [id, updateBlockData]
  );

  const handleExpand = useCallback(async () => {
    if (!blockData.content.trim()) return;

    updateBlockStatus(id, 'running');

    try {
      const response = await toolsApi.expand(blockData.content, blockData.model);
      
      // Create new block with expanded text
      const store = useCanvasStore.getState();
      const currentNode = store.nodes.find((n) => n.id === id);
      if (!currentNode) return;

      const newBlockId = addTextBlock(
        {
          x: currentNode.position.x + 350,
          y: currentNode.position.y,
        },
        {
          content: response.result,
          title: blockData.title ? `${blockData.title} (expanded)` : 'Expanded',
          generatedBy: 'expand',
          sourceBlockId: id,
          model: blockData.model,
        }
      );

      // Add edge from this block to new block
      store.onConnect({
        source: id,
        target: newBlockId,
        sourceHandle: null,
        targetHandle: null,
      });

      updateBlockStatus(id, 'success');
    } catch (error) {
      updateBlockStatus(id, 'error', error instanceof Error ? error.message : 'Failed to expand');
    }
  }, [id, blockData, updateBlockStatus, addTextBlock]);

  const handleGenerateImage = useCallback(async () => {
    if (!blockData.content.trim()) return;

    updateBlockStatus(id, 'running');

    try {
      const response = await toolsApi.generate(blockData.content);
      
      // Create new image block
      const store = useCanvasStore.getState();
      const currentNode = store.nodes.find((n) => n.id === id);
      if (!currentNode) return;

      const newBlockId = addImageBlock(
        {
          x: currentNode.position.x + 350,
          y: currentNode.position.y,
        },
        {
          imageUrl: response.imageUrl,
          imageId: response.imageId,
          source: 'generated',
          title: blockData.title || 'Generated Image',
          prompt: blockData.content,
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
      updateBlockStatus(id, 'error', error instanceof Error ? error.message : 'Failed to generate');
    }
  }, [id, blockData, updateBlockStatus, addImageBlock]);

  const statusIcon = {
    idle: null,
    running: <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />,
    success: <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />,
    error: <AlertCircle size={14} style={{ color: 'var(--accent-error)' }} />,
  }[blockData.status];

  return (
    <div
      className="relative min-w-[280px] max-w-[400px] rounded-xl transition-all duration-200"
      style={{
        background: 'var(--bg-card)',
        border: `2px solid ${selected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
        boxShadow: selected ? 'var(--shadow-glow)' : 'var(--shadow-card)',
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3! h-3!"
        style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--border-default)',
        }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <Type size={16} style={{ color: 'var(--accent-primary)' }} />
        <input
          type="text"
          value={blockData.title}
          onChange={handleTitleChange}
          placeholder="Untitled"
          className="flex-1 bg-transparent text-sm font-medium outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        {statusIcon}
      </div>

      {/* Content */}
      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={blockData.content}
          onChange={handleContentChange}
          placeholder="Start writing your idea..."
          rows={3}
          className="w-full bg-transparent text-sm resize-none outline-none"
          style={{
            color: 'var(--text-primary)',
            minHeight: '60px',
            maxHeight: '200px',
          }}
        />
      </div>

      {/* Footer with model selector */}
      <div
        className="flex items-center justify-between px-3 py-2 border-t"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {/* Model selector */}
        <div className="relative">
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
            }}
          >
            {TEXT_MODELS.find((m) => m.value === blockData.model)?.label || blockData.model}
            <ChevronDown size={12} />
          </button>

          {isModelDropdownOpen && (
            <div
              className="absolute bottom-full left-0 mb-1 py-1 rounded-lg z-10 min-w-[120px]"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {TEXT_MODELS.map((model) => (
                <button
                  key={model.value}
                  onClick={() => handleModelChange(model.value)}
                  className="w-full px-3 py-1.5 text-left text-xs transition-colors"
                  style={{
                    color: blockData.model === model.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: blockData.model === model.value ? 'var(--bg-card-hover)' : 'transparent',
                  }}
                >
                  {model.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar - shown when selected */}
      {selected && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 flex items-center gap-1 px-2 py-1 rounded-lg z-10"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <button
            onClick={handleExpand}
            disabled={blockData.status === 'running' || !blockData.content.trim()}
            className="p-1.5 rounded transition-all disabled:opacity-50 hover:bg-opacity-80"
            style={{
              background: blockData.status === 'running' || !blockData.content.trim() ? 'transparent' : 'var(--accent-primary)',
              color: 'white',
            }}
            title="Expand this text"
          >
            <Sparkles size={16} />
          </button>
        </div>
      )}

      {/* Error message */}
      {blockData.status === 'error' && blockData.error && (
        <div
          className="px-3 py-2 text-xs border-t"
          style={{
            borderColor: 'var(--accent-error)',
            color: 'var(--accent-error)',
            background: 'rgba(239, 68, 68, 0.1)',
          }}
        >
          {blockData.error}
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3! h-3!"
        style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--border-default)',
        }}
      />
    </div>
  );
}

export const TextBlockNode = memo(TextBlockNodeComponent);

