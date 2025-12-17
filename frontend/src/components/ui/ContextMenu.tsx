import { useEffect, useRef } from 'react';
import { Type, Image, X } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  title?: string;
  onAddTextBlock: () => void;
  onAddImageBlock: () => void;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  title,
  onAddTextBlock,
  onAddImageBlock,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position if menu would overflow viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 150);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 animate-fade-in"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div
        className="min-w-[180px] rounded-lg border shadow-lg overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {title && (
          <div
            className="px-3 py-2 text-xs font-medium uppercase tracking-wider border-b"
            style={{
              color: 'var(--text-muted)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {title}
          </div>
        )}

        <div>
          <button
            onClick={onAddTextBlock}
            className="w-full px-3 py-2 flex items-center gap-3 transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-card-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Type size={16} style={{ color: 'var(--accent-primary)' }} />
            <div className="text-left">
              <div className="text-sm font-medium">Text block</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Write or expand ideas
              </div>
            </div>
          </button>

          <button
            onClick={onAddImageBlock}
            className="w-full px-3 py-2 flex items-center gap-3 transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-card-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Image size={16} style={{ color: 'var(--accent-secondary)' }} />
            <div className="text-left">
              <div className="text-sm font-medium">Image block</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Upload or generate images
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
