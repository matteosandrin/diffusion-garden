import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Sparkles,
  Loader2,
  ChevronDown,
  Trash2,
  Play,
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
  const { updateBlockData, updateBlockStatus, addTextBlock, deleteNode } = useCanvasStore();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize content textarea
  useEffect(() => {
    if (contentTextareaRef.current) {
      contentTextareaRef.current.style.height = 'auto';
      contentTextareaRef.current.style.height = `${contentTextareaRef.current.scrollHeight}px`;
    }
  }, [blockData.content]);

  // Auto-resize prompt textarea
  useEffect(() => {
    if (promptTextareaRef.current) {
      promptTextareaRef.current.style.height = 'auto';
      promptTextareaRef.current.style.height = `${promptTextareaRef.current.scrollHeight}px`;
    }
  }, [blockData.prompt]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateBlockData(id, { content: e.target.value });
    },
    [id, updateBlockData]
  );

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateBlockData(id, { prompt: e.target.value });
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

  const handleExecute = useCallback(async () => {
    const promptToExecute = blockData.prompt?.trim() || blockData.content.trim();
    if (!promptToExecute) return;

    updateBlockStatus(id, 'running');

    try {
      const response = await toolsApi.expand(promptToExecute, blockData.model);
      
      // Update content with the result
      updateBlockData(id, { content: response.result });
      updateBlockStatus(id, 'success');
    } catch (error) {
      updateBlockStatus(id, 'error', error instanceof Error ? error.message : 'Failed to execute');
    }
  }, [id, blockData, updateBlockStatus, updateBlockData]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

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
        className="!w-3 !h-3"
        style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--border-default)',
        }}
      />

      {/* Content section (top half) */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <textarea
          ref={contentTextareaRef}
          value={blockData.content}
          onChange={handleContentChange}
          placeholder="Result will appear here..."
          rows={3}
          className="w-full bg-transparent text-sm resize-none outline-none"
          style={{
            color: 'var(--text-primary)',
            minHeight: '60px',
            maxHeight: '200px',
          }}
        />
      </div>

      {/* Prompt section (bottom half) */}
      <div className="p-3">
        <textarea
          ref={promptTextareaRef}
          value={blockData.prompt || ''}
          onChange={handlePromptChange}
          placeholder="Enter your prompt here..."
          rows={2}
          className="w-full bg-transparent text-sm resize-none outline-none"
          style={{
            color: 'var(--text-secondary)',
            minHeight: '40px',
            maxHeight: '150px',
          }}
        />
      </div>

      {/* Footer with model selector and play button */}
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

        {/* Play button */}
        <button
          onClick={handleExecute}
          disabled={blockData.status === 'running' || (!blockData.prompt?.trim() && !blockData.content.trim())}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all disabled:opacity-50"
          style={{
            background: blockData.status === 'running' || (!blockData.prompt?.trim() && !blockData.content.trim()) 
              ? 'transparent' 
              : 'var(--accent-primary)',
            color: 'white',
          }}
          title="Execute prompt"
        >
          {blockData.status === 'running' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
        </button>
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
          <button
            onClick={handleDelete}
            disabled={blockData.status === 'running'}
            className="p-1.5 rounded transition-all disabled:opacity-50 hover:bg-opacity-80"
            style={{
              background: blockData.status === 'running' ? 'transparent' : 'var(--accent-error)',
              color: 'white',
            }}
            title="Delete this block"
          >
            <Trash2 size={16} />
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
        className="!w-3 !h-3"
        style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--border-default)',
        }}
      />
    </div>
  );
}

export const TextBlockNode = memo(TextBlockNodeComponent);

