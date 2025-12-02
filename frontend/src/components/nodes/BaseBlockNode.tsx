import { useCallback, useRef, useEffect, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Trash2, Play, Loader2 } from 'lucide-react';
import type { BlockStatus } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';

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
  glowShadow?: string;
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
  glowShadow = 'var(--shadow-glow)',
  blockType,
}: BaseBlockNodeProps) {
  const { deleteNode } = useCanvasStore();
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize prompt textarea
  useEffect(() => {
    if (promptTextareaRef.current) {
      promptTextareaRef.current.style.height = 'auto';
      promptTextareaRef.current.style.height = `${promptTextareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  // Determine box shadow based on status and selection
  const getBoxShadow = () => {
    if (status === 'running') {
      return glowShadow;
    }
    if (selected) {
      return glowShadow;
    }
    return 'var(--shadow-card)';
  };

  // Determine if we should animate the glow
  const shouldAnimateGlow = status === 'running';

  // Create a brighter version of the glow for the pulse effect
  const getPulseGlow = () => {
    // Extract rgba values and increase opacity for pulse
    if (glowShadow.includes('rgba')) {
      const match = glowShadow.match(/rgba\(([^)]+)\)/);
      if (match) {
        const values = match[1].split(',').map(v => v.trim());
        if (values.length === 4) {
          const r = values[0];
          const g = values[1];
          const b = values[2];
          const a = parseFloat(values[3]);
          const pulseA = Math.min(1, a * 2); // Double the opacity for pulse
          return glowShadow.replace(/rgba\([^)]+\)/, `rgba(${r}, ${g}, ${b}, ${pulseA})`);
        }
      }
    }
    // Fallback: increase blur radius
    return glowShadow.replace(/(\d+)px/, (_match, num) => `${parseInt(num) + 20}px`);
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
          ...(shouldAnimateGlow && {
            animation: 'glowPulse 2s ease-in-out infinite',
            '--glow-shadow': glowShadow,
            '--glow-shadow-pulse': getPulseGlow(),
          } as React.CSSProperties),
        }}
      >

        {/* Main content */}
        {children}

        {/* Prompt section */}
        {(prompt !== undefined || onPromptChange) && (
          <div className={`p-3 border-t ${selected ? 'nowheel' : ''}`} style={{ borderColor: 'var(--border-subtle)' }}>
            <textarea
              ref={promptTextareaRef}
              value={prompt || ''}
              onChange={(e) => onPromptChange?.(e.target.value)}
              placeholder={promptPlaceholder}
              rows={2}
              readOnly={promptReadonly}
              disabled={promptReadonly}
              className="w-full bg-transparent resize-none outline-none"
              style={{
                color: promptReadonly ? 'var(--text-muted)' : 'var(--text-secondary)',
                minHeight: '40px',
                maxHeight: '150px',
                cursor: promptReadonly ? 'default' : 'text',
                opacity: promptReadonly ? 0.7 : 1,
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
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all disabled:opacity-50"
                style={{
                  background: status === 'running' || runButtonDisabled
                    ? 'transparent'
                    : accentColor,
                  color: 'white',
                }}
                title={runButtonTitle}
              >
                {status === 'running' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
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
              background: 'rgba(239, 68, 68, 0.1)',
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
          <button
            onClick={handleDelete}
            disabled={status === 'running'}
            className="p-1.5 rounded transition-all disabled:opacity-50 hover:bg-opacity-80"
            style={{
              background: status === 'running' ? 'transparent' : 'var(--accent-error)',
              color: 'white',
            }}
            title="Delete this block"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {/* Input handle */}
      <Handle type="target" position={Position.Left} />

      {/* Output handle */}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

