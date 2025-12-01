import { useEffect, useState } from 'react';
import { X, CheckCircle, XCircle, Key } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { settingsApi } from '../../api/client';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useCanvasStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check API key status on mount
    const checkStatus = async () => {
      try {
        const status = await settingsApi.checkApiKeys();
        updateSettings({
          apiKeyStatus: status,
        });
      } catch (error) {
        console.error('Failed to check API key status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();
  }, [updateSettings]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.8)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl animate-fade-in"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* API Key Status */}
          <div>
            <h3
              className="flex items-center gap-2 text-sm font-medium mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              <Key size={16} />
              API Key Status
            </h3>
            
            <div className="space-y-2">
              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-elevated)' }}
              >
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  OpenAI
                </span>
                {isLoading ? (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Checking...
                  </span>
                ) : settings.apiKeyStatus.openai ? (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent-success)' }}>
                    <CheckCircle size={14} />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent-error)' }}>
                    <XCircle size={14} />
                    Not configured
                  </span>
                )}
              </div>

              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-elevated)' }}
              >
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Google (Gemini)
                </span>
                {isLoading ? (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Checking...
                  </span>
                ) : settings.apiKeyStatus.google ? (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent-success)' }}>
                    <CheckCircle size={14} />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent-error)' }}>
                    <XCircle size={14} />
                    Not configured
                  </span>
                )}
              </div>
            </div>

            <p
              className="mt-2 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Configure API keys in the backend .env file
            </p>
          </div>

          {/* Keyboard Shortcuts */}
          <div>
            <h3
              className="text-sm font-medium mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              Keyboard Shortcuts
            </h3>
            
            <div className="space-y-2 text-sm">
              {[
                { key: 'N', action: 'New text block' },
                { key: 'I', action: 'New image block' },
                { key: '⌘/Ctrl + Enter', action: 'Run default tool' },
                { key: 'Delete', action: 'Delete selected' },
                { key: 'Escape', action: 'Deselect / Close' },
              ].map(({ key, action }) => (
                <div
                  key={key}
                  className="flex items-center justify-between"
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{action}</span>
                  <kbd
                    className="px-2 py-0.5 rounded text-xs font-mono"
                    style={{
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t text-center"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            AI Blocks Canvas v0.1.0
          </p>
        </div>
      </div>
    </div>
  );
}

