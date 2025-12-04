import { useEffect, useCallback, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/ui/Toolbar";
import { EmptyState } from "./components/EmptyState";
import { CanvasGallery } from "./components/CanvasGallery";
import { useCanvasStore } from "./store/canvasStore";
import { canvasApi, settingsApi } from "./api/client";
import { useDebouncedCallback } from "./hooks/useDebouncedCallback";
import type { CanvasSummary } from "./types";

type ViewMode = "loading" | "gallery" | "canvas";

function AppContent() {
  const {
    nodes,
    edges,
    viewport,
    canvasId,
    setCanvasId,
    loadCanvas,
    addTextBlock,
    addImageBlock,
    deleteSelectedNodes,
    selectedNodeIds,
    setSaving,
    setLastSaved,
    setPrompts,
    setModels,
    contextMenu,
    edgeDropMenu,
  } = useCanvasStore();

  const [viewMode, setViewMode] = useState<ViewMode>("loading");
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);

  // Auto-save with debounce
  const saveCanvas = useDebouncedCallback(
    async () => {
      if (!canvasId) return;

      setSaving(true);
      try {
        await canvasApi.save(canvasId, {
          nodes,
          edges,
          viewport,
        });
        setLastSaved(new Date());
      } catch (error) {
        console.error("Failed to save canvas:", error);
      } finally {
        setSaving(false);
      }
    },
    1000, // 1 second debounce
    [canvasId, nodes, edges, viewport],
  );

  // Save on changes
  useEffect(() => {
    if (canvasId && (nodes.length > 0 || edges.length > 0)) {
      saveCanvas();
    }
  }, [nodes, edges, viewport, canvasId, saveCanvas]);

  // Fetch prompts and models at session start
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const prompts = await settingsApi.getPrompts();
        setPrompts(prompts);
      } catch (error) {
        console.error("Failed to fetch prompts:", error);
      }
    };

    const fetchModels = async () => {
      try {
        const models = await settingsApi.getModels();
        setModels(models);
      } catch (error) {
        console.error("Failed to fetch models:", error);
      }
    };

    fetchPrompts();
    fetchModels();
  }, [setPrompts, setModels]);

  const navigateToCanvas = (id: string) => {
    window.history.pushState({}, "", `/c/${id}`);
  };

  const navigateToGallery = () => {
    window.history.pushState({}, "", "/");
  };

  // Extract canvas ID from URL path like /c/<id>
  const getCanvasIdFromUrl = useCallback(() => {
    const match = window.location.pathname.match(/^\/c\/([^/]+)/);
    return match ? match[1] : null;
  }, []);

  const openCanvas = async (id: string, pushHistory = true) => {
    try {
      const canvas = await canvasApi.load(id);
      setCanvasId(id);
      loadCanvas(canvas.nodes as any, canvas.edges as any, canvas.viewport);
      if (pushHistory) {
        navigateToCanvas(id);
      }
      setViewMode("canvas");
    } catch (error) {
      console.error("Failed to load canvas:", error);
    }
  };

  const showGallery = async () => {
    try {
      const canvasList = await canvasApi.list();
      setCanvases(canvasList);
      setViewMode("gallery");
    } catch (error) {
      console.error("Failed to fetch canvases:", error);
    }
  };

  const createNewCanvas = async () => {
    try {
      const { id: newId } = await canvasApi.create();
      setCanvasId(newId);
      loadCanvas([], [], { x: 0, y: 0, zoom: 1 });
      navigateToCanvas(newId);
      setViewMode("canvas");
    } catch (error) {
      console.error("Failed to create canvas:", error);
    }
  };

  const deleteCanvas = async (id: string) => {
    try {
      await canvasApi.delete(id);
      // Refresh the gallery
      const canvasList = await canvasApi.list();
      if (canvasList.length > 0) {
        setCanvases(canvasList);
      } else {
        // No canvases left, create a new one
        await createNewCanvas();
      }
    } catch (error) {
      console.error("Failed to delete canvas:", error);
    }
  };

  // Initialize app - check URL or show gallery
  useEffect(() => {
    const initApp = async () => {
      const urlCanvasId = getCanvasIdFromUrl();

      // If canvas ID in URL, try to load it directly
      if (urlCanvasId) {
        try {
          const canvas = await canvasApi.load(urlCanvasId);
          setCanvasId(urlCanvasId);
          loadCanvas(canvas.nodes as any, canvas.edges as any, canvas.viewport);
          setViewMode("canvas");
          return;
        } catch (error) {
          console.log("Canvas from URL not found");
          navigateToGallery();
        }
      }

      // No canvas in URL - fetch list of canvases
      try {
        const canvasList = await canvasApi.list();

        if (canvasList.length > 0) {
          // Show gallery if canvases exist
          setCanvases(canvasList);
          setViewMode("gallery");
        } else {
          // No canvases exist - create a new one
          await createNewCanvas();
        }
      } catch (error) {
        console.error("Failed to fetch canvases:", error);
        // Fallback: create new canvas
        await createNewCanvas();
      }
    };

    initApp();
  }, [setCanvasId, loadCanvas]);

  // Keyboard shortcuts (only in canvas view)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle shortcuts in canvas view
      if (viewMode !== "canvas") return;

      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Skip T/I shortcuts when context menu is open (it handles them)
      if (contextMenu || edgeDropMenu) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "t":
          e.preventDefault();
          addTextBlock();
          break;
        case "i":
          e.preventDefault();
          addImageBlock();
          break;
        case "delete":
        case "backspace":
          if (selectedNodeIds.length > 0) {
            e.preventDefault();
            deleteSelectedNodes();
          }
          break;
        case "escape":
          useCanvasStore.getState().clearSelection();
          break;
      }
    },
    [
      viewMode,
      addTextBlock,
      addImageBlock,
      deleteSelectedNodes,
      selectedNodeIds,
      contextMenu,
      edgeDropMenu,
    ],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = async () => {
      const urlCanvasId = getCanvasIdFromUrl();

      if (urlCanvasId) {
        // Navigate to canvas (without pushing to history)
        await openCanvas(urlCanvasId, false);
      } else {
        // Navigate to gallery
        await showGallery();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [getCanvasIdFromUrl]);

  // Loading state
  if (viewMode === "loading") {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: "var(--bg-canvas)" }}
      >
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{
            borderColor: "var(--border-subtle)",
            borderTopColor: "var(--accent-primary)",
          }}
        />
      </div>
    );
  }

  // Gallery view
  if (viewMode === "gallery") {
    return (
      <CanvasGallery
        canvases={canvases}
        onSelectCanvas={openCanvas}
        onCreateNew={createNewCanvas}
        onDeleteCanvas={deleteCanvas}
      />
    );
  }

  // Canvas view
  const isEmpty = nodes.length === 0;

  return (
    <div
      className="w-full h-full relative"
      style={{ background: "var(--bg-canvas)" }}
    >
      <Toolbar
        onBackToGallery={() => {
          navigateToGallery();
          showGallery();
        }}
      />
      <Canvas />
      {isEmpty ? (
        <EmptyState />
      ) : (
        // App title chip
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: 16, zIndex: 10 }}
        >
          <div
            className="px-4 py-1.5 rounded-full backdrop-blur-md flex items-center justify-center gap-2"
            style={{
              background: "rgba(26, 26, 26, 0.7)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "0 2px 12px rgba(0, 0, 0, 0.3)",
            }}
          >
            <span className="text-xl">🌻</span>
            <a
              href="/"
              className="text-2xl font-bold hover:underline"
              style={{
                color: "var(--text-primary)",
              }}
            >
              diffusion.garden
            </a>
            <span className="text-xl">🌻</span>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  );
}

export default App;
