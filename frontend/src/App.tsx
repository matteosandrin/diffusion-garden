import { useEffect, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/ui/Toolbar";
import { EmptyState } from "./components/EmptyState";
import { useCanvasStore } from "./store/canvasStore";
import { canvasApi, settingsApi } from "./api/client";
import { useDebouncedCallback } from "./hooks/useDebouncedCallback";

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
  } = useCanvasStore();

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

  // Initialize or load canvas
  useEffect(() => {
    const setCanvasIdInUrl = (id: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set("canvas", id);
      window.history.replaceState({}, "", url.toString());
    };
    const initCanvas = async () => {
      // Check for existing canvas ID in URL or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      let id = urlParams.get("canvas");

      if (!id) {
        id = localStorage.getItem("canvasId");
      }

      if (id) {
        try {
          const canvas = await canvasApi.load(id);
          setCanvasId(id);
          loadCanvas(canvas.nodes as any, canvas.edges as any, canvas.viewport);
          setCanvasIdInUrl(id);
          return;
        } catch (error) {
          console.log("Canvas not found, creating new one");
        }
      }

      // Create new canvas
      try {
        const { id: newId } = await canvasApi.create();
        setCanvasId(newId);
        localStorage.setItem("canvasId", newId);
        setCanvasIdInUrl(newId);
      } catch (error) {
        console.error("Failed to create canvas:", error);
      }
    };

    initCanvas();
  }, [setCanvasId, loadCanvas]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
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
    [addTextBlock, addImageBlock, deleteSelectedNodes, selectedNodeIds],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isEmpty = nodes.length === 0;

  return (
    <div
      className="w-full h-full relative"
      style={{ background: "var(--bg-canvas)" }}
    >
      <Toolbar />
      <Canvas />
      {isEmpty && <EmptyState />}
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
