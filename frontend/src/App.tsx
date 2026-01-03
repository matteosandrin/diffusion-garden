import { useEffect, useCallback, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  Link,
  useLocation,
} from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/ui/Toolbar";
import { EmptyState } from "./components/EmptyState";
import { CanvasGallery } from "./components/CanvasGallery";
import { AnalyticsPage } from "./components/AnalyticsPage";
import { useCanvasStore } from "./store/canvasStore";
import { canvasApi, settingsApi, notifyApi } from "./api/client";
import { useDebouncedCallback } from "./hooks/useDebouncedCallback";
import type { CanvasSummary } from "./types";

function LoadingSpinner() {
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

function GalleryRoute() {
  const navigate = useNavigate();
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setCanvasId, loadCanvas } = useCanvasStore();

  useEffect(() => {
    const fetchCanvases = async () => {
      try {
        const canvasList = await canvasApi.list();

        if (canvasList.length > 0) {
          setCanvases(canvasList);
          setIsLoading(false);
        } else {
          await handleCreateNew();
        }
      } catch (error) {
        console.error("Failed to fetch canvases:", error);
        // Fallback: create new canvas
        try {
          await handleCreateNew();
        } catch (createError) {
          console.error("Failed to create canvas:", createError);
          setIsLoading(false);
        }
      }
    };

    fetchCanvases();
  }, [navigate, setCanvasId, loadCanvas]);

  const handleSelectCanvas = async (id: string) => {
    try {
      const canvas = await canvasApi.load(id);
      useCanvasStore.getState().setCanvasId(id);
      useCanvasStore
        .getState()
        .loadCanvas(canvas.nodes as any, canvas.edges as any, canvas.viewport);
      navigate(`/c/${id}`);
    } catch (error) {
      console.error("Failed to load canvas:", error);
    }
  };

  const handleCreateNew = async () => {
    try {
      const { id: newId } = await canvasApi.create();
      setCanvasId(newId);
      loadCanvas([], [], { x: 0, y: 0, zoom: 1 });
      navigate(`/c/${newId}`);
    } catch (error) {
      console.error("Failed to create canvas:", error);
    }
  };

  const handleDeleteCanvas = async (id: string) => {
    try {
      await canvasApi.delete(id);
      // Refresh the gallery
      const canvasList = await canvasApi.list();
      if (canvasList.length > 0) {
        setCanvases(canvasList);
      } else {
        // No canvases left, create a new one
        await handleCreateNew();
      }
    } catch (error) {
      console.error("Failed to delete canvas:", error);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <CanvasGallery
      canvases={canvases}
      onSelectCanvas={handleSelectCanvas}
      onCreateNew={handleCreateNew}
      onDeleteCanvas={handleDeleteCanvas}
    />
  );
}

// Canvas route component
function CanvasRoute() {
  const { canvasId: urlCanvasId } = useParams<{ canvasId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

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
    contextMenu,
    edgeDropMenu,
  } = useCanvasStore();

  // Load canvas from URL param
  useEffect(() => {
    const loadCanvasFromUrl = async () => {
      if (!urlCanvasId) {
        navigate("/");
        return;
      }

      // Skip if already loaded
      if (canvasId === urlCanvasId && !isLoading) {
        return;
      }

      try {
        const canvas = await canvasApi.load(urlCanvasId);
        setCanvasId(urlCanvasId);
        loadCanvas(canvas.nodes as any, canvas.edges as any, canvas.viewport);
        setIsLoading(false);
      } catch (error) {
        console.log("Canvas from URL not found");
        navigate("/");
      }
    };

    loadCanvasFromUrl();
  }, [urlCanvasId, navigate, setCanvasId, loadCanvas, canvasId, isLoading]);

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
    1000,
    [canvasId, nodes, edges, viewport],
  );

  // Save on changes
  useEffect(() => {
    if (canvasId && (nodes.length > 0 || edges.length > 0) && !isLoading) {
      saveCanvas();
    }
  }, [nodes, edges, viewport, canvasId, saveCanvas, isLoading]);

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

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const isEmpty = nodes.length === 0;

  return (
    <div
      className="w-full h-full relative"
      style={{ background: "var(--bg-canvas)" }}
    >
      <Toolbar onBackToGallery={() => navigate("/")} />
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
            <Link
              to="/"
              className="text-2xl font-bold hover:underline"
              style={{
                color: "var(--text-primary)",
              }}
            >
              diffusion.garden
            </Link>
            <span className="text-xl">🌻</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Analytics route component
function AnalyticsRoute() {
  const navigate = useNavigate();

  return <AnalyticsPage onBack={() => navigate("/")} />;
}

function PageVisitTracker() {
  const location = useLocation();
  const getReferrer = () => {
    const referrer = document.referrer;
    if (
      referrer.includes("diffusion.garden") ||
      referrer.includes("localhost")
    ) {
      return null;
    }
    return referrer;
  };
  useEffect(() => {
    const sendNotification = async () => {
      try {
        await notifyApi.notify(location.pathname, getReferrer());
      } catch (error) {
        // Silently fail - we don't want to interrupt user experience
        console.error("Failed to send page visit notification:", error);
      }
    };
    sendNotification();
  }, [location.pathname]);

  return null;
}

// Main app content with settings initialization
function AppContent() {
  const { setPrompts, setModels } = useCanvasStore();

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

  return (
    <>
      <PageVisitTracker />
      <Routes>
        <Route path="/" element={<GalleryRoute />} />
        <Route path="/c/:canvasId" element={<CanvasRoute />} />
        <Route path="/analytics" element={<AnalyticsRoute />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ReactFlowProvider>
        <AppContent />
      </ReactFlowProvider>
    </BrowserRouter>
  );
}

export default App;
