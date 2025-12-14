import { useCallback, useState, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Trash2, ArrowUp, Loader2, ChevronDown } from 'lucide-react';
import type { BlockStatus } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { BlockToolbarButton } from '../ui/BlockToolbarButton';
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea';

export interface ModelOption {
  id: string;
  label: string;
}

interface BaseBlockNodeProps {
  id: string;
  selected: boolean;
  status: BlockStatus;
  error?: string;
  children: ReactNode;
  toolbarButtons?: ReactNode;
  footerLeftContent?: ReactNode;
  onPlay?: () => void;
  runButtonDisabled?: boolean;
  runButtonTitle?: string;
  prompt?: string;
  onPromptChange?: (value: string) => void;
  promptPlaceholder?: string;
  promptReadonly?: boolean;
  accentColor?: string;
  blockType?: 'text' | 'image';
  // Model dropdown props
  models?: ModelOption[];
  selectedModel?: string;
  onModelChange?: (model: string) => void;
}

export function BaseBlockNode({
  id,
  selected,
  status,
  error,
  children,
  toolbarButtons,
  footerLeftContent,
  onPlay,
  runButtonDisabled,
  runButtonTitle = 'Execute',
  prompt,
  onPromptChange,
  promptPlaceholder = 'Enter your prompt here...',
  promptReadonly = false,
  accentColor = 'var(--accent-primary)',
  blockType,
  models,
  selectedModel,
  onModelChange,
}: BaseBlockNodeProps) {
  const { deleteNode } = useCanvasStore();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  const handleModelSelect = useCallback((model: string) => {
    onModelChange?.(model);
    setIsModelDropdownOpen(false);
  }, [onModelChange]);

  // Determine box shadow based on status and selection
  const getBoxShadow = () => {
    return 'var(--shadow-card)';
  };

  return (
    <div className="text-xs">
      {/* Toolbar - slides down when selected */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-full flex items-center gap-1 px-2 py-1 rounded-lg z-10 transition-all duration-300 ease-out"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          transform: selected ? 'translateY(-0.5rem)' : 'translateY(1rem)',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      >
        {toolbarButtons}
        <BlockToolbarButton
            onClick={handleDelete}
            disabled={status === 'running'}
            title="Delete"
          >
            <Trash2 size={16}/>
        </BlockToolbarButton>
      </div>
      {/* Block type label */}
      {blockType && (
        <div
          className="absolute -top-5 left-0 text-xs px-1.5 py-0.5 rounded"
          style={{
            color: 'var(--text-muted)',
            background: 'transparent',
            fontSize: '10px',
            textTransform: 'capitalize',
            pointerEvents: 'none',
          }}
        >
          {blockType}
        </div>
      )}

      <div
        className="relative w-[280px] rounded-xl transition-all duration-200 overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: `1px solid ${selected ? accentColor : 'var(--border-subtle)'}`,
          boxShadow: getBoxShadow(),
        }}
      >

        {/* Main content */}
        {children}

        {/* Footer with play button */}
        {(onPlay || footerLeftContent || models) && (
          <div
            className="flex items-center justify-between px-3 py-2 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {/* Left content - model selector or custom content */}
            <div>
              {models && models.length > 0 ? (
                <div className="relative">
                  <button
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                    style={{
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {models.find((m) => m.id === selectedModel)?.label || selectedModel}
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
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleModelSelect(model.id)}
                          className="w-full px-3 py-1.5 text-left text-xs transition-colors"
                          style={{
                            color: selectedModel === model.id ? accentColor : 'var(--text-secondary)',
                            background: selectedModel === model.id ? 'var(--bg-card-hover)' : 'transparent',
                          }}
                        >
                          {model.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                footerLeftContent || null
              )}
            </div>

            {/* Play button */}
            {onPlay && (
              <button
                onClick={onPlay}
                disabled={status === 'running' || runButtonDisabled}
                className="flex items-center gap-1 px-1 py-1 rounded-full text-xs transition-all disabled:opacity-30"
                style={{
                  background: accentColor,
                  color: 'black',
                }}
                title={runButtonTitle}
              >
                {status === 'running' ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <ArrowUp size={20} strokeWidth={3}/>
                )}
              </button>
            )}
          </div>
        )}

        {/* Error message */}
        {status === 'error' && error && (
          <div
            className="px-3 py-2 text-xs border-t"
            style={{
              borderColor: 'var(--accent-error)',
              color: 'var(--accent-error)',
              background: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Prompt bubble - slides down when selected */}
      {(prompt !== undefined || onPromptChange) && (
        <div
          className="absolute left-0 top-full w-full px-3 py-2 rounded-lg z-10 transition-all duration-300 ease-out"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-card)',
            transform: selected ? 'translateY(0.5rem)' : 'translateY(-1rem)',
            opacity: selected ? 1 : 0,
            pointerEvents: selected ? 'auto' : 'none',
          }}
        >
          <AutoResizeTextarea
            value={prompt || ''}
            onChange={(value) => onPromptChange?.(value)}
            placeholder={promptPlaceholder}
            rows={2}
            readOnly={promptReadonly}
            disabled={promptReadonly}
            minHeight="45px"
            maxHeight="120px"
            style={{
              color: promptReadonly ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: promptReadonly ? 'default' : 'text',
            }}
          />
        </div>
      )}

      {/* Input handle */}
      <Handle type="target" position={Position.Left} />

      {/* Output handle */}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

