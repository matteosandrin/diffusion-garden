import { useState } from "react";
import { Type, Image, Settings, LayoutGrid } from "lucide-react";
import { useCanvasStore } from "../../store/canvasStore";
import { SettingsPanel } from "./SettingsPanel";
import { ToolbarButton } from "./ToolbarButton";

interface ToolbarProps {
  onBackToGallery?: () => void;
}

export function Toolbar({ onBackToGallery }: ToolbarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { addTextBlock, addImageBlock } = useCanvasStore();

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
        <ToolbarButton
          onClick={addTextBlock}
          icon={<Type size={16} style={{ color: "var(--accent-primary)" }} />}
          label="Text"
        />

        <ToolbarButton
          onClick={addImageBlock}
          icon={<Image size={16} style={{ color: "var(--accent-primary)" }} />}
          label="Image"
        />

        <div
          className="w-px h-6 mx-1"
          style={{ background: "var(--border-subtle)" }}
        />

        {/* Back to gallery */}
        {onBackToGallery && (
          <ToolbarButton
            onClick={onBackToGallery}
            icon={<LayoutGrid size={18} />}
            title="Gallery"
          />
        )}

        {/* Settings */}
        <ToolbarButton
          onClick={() => setIsSettingsOpen(true)}
          icon={<Settings size={18} />}
          title="Settings"
        />
      </div>

      {/* Settings panel */}
      {isSettingsOpen && (
        <SettingsPanel onClose={() => setIsSettingsOpen(false)} />
      )}
    </>
  );
}
