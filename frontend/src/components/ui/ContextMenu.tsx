import { useEffect, useRef } from "react";
import { Type, Image } from "lucide-react";

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case "escape":
          onClose();
          break;
        case "t":
          event.preventDefault();
          onAddTextBlock();
          break;
        case "i":
          event.preventDefault();
          onAddImageBlock();
          break;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, onAddTextBlock, onAddImageBlock]);

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
          background: "var(--bg-card)",
          borderColor: "var(--border-subtle)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {title && (
          <div
            className="px-3 py-2 text-xs font-medium uppercase tracking-wider border-b"
            style={{
              color: "var(--text-muted)",
              borderColor: "var(--border-subtle)",
            }}
          >
            {title}
          </div>
        )}

        <div>
          <button
            onClick={onAddTextBlock}
            className="w-full px-3 py-2 flex items-center gap-3 transition-colors"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-card-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Type size={16} style={{ color: "var(--accent-primary)" }} />
            <div className="text-left flex-1">
              <div className="text-sm font-medium">Text block</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Write or expand ideas
              </div>
            </div>
            <kbd
              className="px-1.5 py-0.5 text-xs rounded"
              style={{
                background: "var(--bg-card-hover)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              T
            </kbd>
          </button>

          <button
            onClick={onAddImageBlock}
            className="w-full px-3 py-2 flex items-center gap-3 transition-colors"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-card-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Image size={16} style={{ color: "var(--accent-secondary)" }} />
            <div className="text-left flex-1">
              <div className="text-sm font-medium">Image block</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Upload or generate images
              </div>
            </div>
            <kbd
              className="px-1.5 py-0.5 text-xs rounded"
              style={{
                background: "var(--bg-card-hover)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              I
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
