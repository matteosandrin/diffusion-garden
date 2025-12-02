import { useCallback, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Trash2, ArrowUp, Loader2 } from 'lucide-react';
import type { BlockStatus } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { BlockToolbarButton } from '../ui/BlockToolbarButton';
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea';

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
}: BaseBlockNodeProps) {
  const { deleteNode } = useCanvasStore();

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  // Determine box shadow based on status and selection
  const getBoxShadow = () => {
    return 'var(--shadow-card)';
  };

  return (
    <div>
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
        className="relative min-w-[280px] max-w-[400px] rounded-xl transition-all duration-200 overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: `2px solid ${selected ? accentColor : 'var(--border-subtle)'}`,
          boxShadow: getBoxShadow(),
        }}
      >

        {/* Main content */}
        {children}

        {/* Prompt section */}
        {(prompt !== undefined || onPromptChange) && (
          <div className={`p-3 border-t ${selected ? 'nowheel' : ''}`} style={{ borderColor: 'var(--border-subtle)' }}>
            <AutoResizeTextarea
              value={prompt || ''}
              onChange={(value) => onPromptChange?.(value)}
              placeholder={promptPlaceholder}
              rows={2}
              readOnly={promptReadonly}
              disabled={promptReadonly}
              minHeight="40px"
              maxHeight="150px"
              style={{
                color: promptReadonly ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: promptReadonly ? 'default' : 'text',
              }}
            />
          </div>
        )}

        {/* Footer with play button */}
        {(onPlay || footerLeftContent) && (
          <div
            className="flex items-center justify-between px-3 py-2 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {/* Left content (e.g., model selector) */}
            <div>
              {footerLeftContent || null}
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
          {toolbarButtons}
          <BlockToolbarButton
              onClick={handleDelete}
              disabled={status === 'running'}
              title="Delete this block"
            >
              <Trash2 size={16}/>
          </BlockToolbarButton>
        </div>
      )}

      {/* Input handle */}
      <Handle type="target" position={Position.Left} />

      {/* Output handle */}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

