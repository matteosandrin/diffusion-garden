import { useState } from "react";
import { Type, Image, Settings } from "lucide-react";
import { useCanvasStore } from "../../store/canvasStore";
import { SettingsPanel } from "./SettingsPanel";

export function Toolbar() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { addTextBlock, addImageBlock } = useCanvasStore();

  const handleAddTextBlock = () => {
    addTextBlock();
  };

  const handleAddImageBlock = () => {
    addImageBlock();
  };

  return (
    <>
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-full"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Add blocks */}
        <button
          onClick={handleAddTextBlock}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{ color: "var(--text-primary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-card-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
          title="Add Text Block (N)"
        >
          <Type size={16} style={{ color: "var(--accent-primary)" }} />
          Text
        </button>

        <button
          onClick={handleAddImageBlock}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{ color: "var(--text-primary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-card-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
          title="Add Image Block (I)"
        >
          <Image size={16} style={{ color: "var(--accent-primary)" }} />
          Image
        </button>

        <div
          className="w-px h-6 mx-1"
          style={{ background: "var(--border-subtle)" }}
        />

        {/* Settings */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-lg transition-all"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-card-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Settings panel */}
      {isSettingsOpen && (
        <SettingsPanel onClose={() => setIsSettingsOpen(false)} />
      )}
    </>
  );
}
