import { useState } from "react";
import { Plus, Flower2, Layers, X } from "lucide-react";
import type { CanvasSummary } from "../types";

interface CanvasGalleryProps {
  canvases: CanvasSummary[];
  onSelectCanvas: (id: string) => void;
  onCreateNew: () => void;
  onDeleteCanvas: (id: string) => void;
}

export function CanvasGallery({
  canvases,
  onSelectCanvas,
  onCreateNew,
  onDeleteCanvas,
}: CanvasGalleryProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, canvasId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(canvasId);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      onDeleteCanvas(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <div
      className="w-full h-full overflow-auto"
      style={{ background: "var(--bg-canvas)" }}
    >
      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h1
            className="text-4xl font-bold mb-3 flex items-center justify-center gap-3"
            style={{ color: "var(--text-primary)" }}
          >
            <span className="text-2xl">🌻</span>
            <span>diffusion.garden</span>
            <span className="text-2xl">🌻</span>
          </h1>
          <p
            className="text-sm max-w-md mx-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            Pick up where you left off or start a fresh canvas
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* New Canvas Card */}
          <button
            onClick={onCreateNew}
            className="group aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all duration-200"
            style={{
              borderColor: "var(--border-subtle)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-primary)";
              e.currentTarget.style.background = "var(--bg-card)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <Plus
                size={24}
                style={{ color: "var(--text-secondary)" }}
                className="group-hover:scale-110 transition-transform"
              />
            </div>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              New Canvas
            </span>
          </button>

          {/* Canvas Cards */}
          {canvases.map((canvas, index) => (
            <div
              key={canvas.id}
              className="group aspect-square rounded-xl overflow-hidden transition-all duration-200 text-left relative cursor-pointer"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                animationDelay: `${index * 50}ms`,
              }}
              onClick={() => onSelectCanvas(canvas.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-primary)";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "var(--shadow-card)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Delete button */}
              <button
                onClick={(e) => handleDeleteClick(e, canvas.id)}
                className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{
                  background: "rgba(0, 0, 0, 0.7)",
                  border: "1px solid var(--border-subtle)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 60, 60, 0.9)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(0, 0, 0, 0.7)";
                }}
              >
                <X size={14} style={{ color: "white" }} />
              </button>

              {/* Thumbnail area */}
              <div
                className="w-full h-3/4 flex items-center justify-center overflow-hidden"
                style={{ background: "var(--bg-elevated)" }}
              >
                {canvas.thumbnailUrl ? (
                  <img
                    src={canvas.thumbnailUrl}
                    alt="Canvas thumbnail"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Flower2
                      size={32}
                      strokeWidth={1}
                      style={{ color: "var(--text-muted)" }}
                    />
                  </div>
                )}
              </div>

              {/* Info area */}
              <div className="h-1/4 px-3 py-2 flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Layers size={12} />
                    <span>{canvas.nodeCount} blocks</span>
                  </div>
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatDate(canvas.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.8)" }}
          onClick={handleCancelDelete}
        >
          <div
            className="rounded-xl p-6 max-w-sm mx-4 animate-fade-in"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Delete Canvas?
            </h2>
            <p
              className="text-sm mb-6"
              style={{ color: "var(--text-secondary)" }}
            >
              This action cannot be undone. All blocks and images in this canvas
              will be permanently deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-card-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-elevated)";
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "#dc2626",
                  color: "white",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#b91c1c";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#dc2626";
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

