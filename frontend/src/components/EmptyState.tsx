import { Sparkles, Type, Image, ArrowRight } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';

export function EmptyState() {
  const { addTextBlock, addImageBlock } = useCanvasStore();

  const handleAddText = () => {
    addTextBlock();
  };

  const handleAddImage = () => {
    addImageBlock();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div
        className="text-center p-8 rounded-2xl max-w-md pointer-events-auto animate-fade-in"
        style={{
          background: 'linear-gradient(180deg, var(--bg-card) 0%, transparent 100%)',
        }}
      >
        {/* Icon */}
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
          style={{
            background: 'var(--gradient-primary)',
            boxShadow: '0 8px 32px rgba(255, 255, 255, 0.2)',
          }}
        >
          <Sparkles size={32} color="black" />
        </div>

        {/* Title */}
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Start creating
        </h2>

        {/* Description */}
        <p
          className="text-sm mb-8 max-w-xs mx-auto"
          style={{ color: 'var(--text-secondary)' }}
        >
          Drop in an idea and start branching. Connect blocks to explore and evolve your thoughts.
        </p>

        {/* Quick actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleAddText}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: 'var(--accent-primary)',
              color: 'black',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Type size={16} />
            Add Text
          </button>

          <button
            onClick={handleAddImage}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: 'var(--accent-secondary)',
              color: 'black',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Image size={16} />
            Add Image
          </button>
        </div>

        {/* Tips */}
        <div
          className="mt-8 pt-6 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p
            className="text-xs font-medium mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            QUICK TIPS
          </p>
          <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-2 justify-center">
              <kbd
                className="px-1.5 py-0.5 rounded font-mono"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                N
              </kbd>
              <span>for new text</span>
              <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
              <kbd
                className="px-1.5 py-0.5 rounded font-mono"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                I
              </kbd>
              <span>for new image</span>
            </div>
            <p>Right-click anywhere to add blocks</p>
          </div>
        </div>
      </div>
    </div>
  );
}

