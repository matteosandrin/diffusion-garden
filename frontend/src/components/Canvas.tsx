import { useCallback, useRef, useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  SelectionMode,
  type OnSelectionChangeParams,
  type Node,
  type Viewport,
  type OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCanvasStore } from "../store/canvasStore";
import { TextBlockNode } from "./nodes/TextBlockNode";
import { ImageBlockNode } from "./nodes/ImageBlockNode";
import { AnimatedEdge } from "./edges/AnimatedEdge";
import { ContextMenu } from "./ui/ContextMenu";
import {
  PendingEdgeOverlay,
  type PendingEdge,
} from "./edges/PendingEdgeOverlay";

// Register custom node types
const nodeTypes = {
  textBlock: TextBlockNode,
  imageBlock: ImageBlockNode,
};

// Register custom edge types
const edgeTypes = {
  animated: AnimatedEdge,
};

export function Canvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const connectingNodeId = useRef<string | null>(null);
  const { screenToFlowPosition, setCenter } = useReactFlow();

  const {
    nodes,
    edges,
    defaultBlockSize,
    contextMenu,
    edgeDropMenu,
    pendingCenterNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodes,
    setViewport,
    addTextBlock,
    addImageBlock,
    addTextBlockWithEdge,
    addImageBlockWithEdge,
    setContextMenu,
    setEdgeDropMenu,
    closeMenus,
    setPendingCenterNodeId,
  } = useCanvasStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      defaultBlockSize: state.defaultBlockSize,
      contextMenu: state.contextMenu,
      edgeDropMenu: state.edgeDropMenu,
      pendingCenterNodeId: state.pendingCenterNodeId,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      onConnect: state.onConnect,
      setSelectedNodes: state.setSelectedNodes,
      setViewport: state.setViewport,
      addTextBlock: state.addTextBlock,
      addImageBlock: state.addImageBlock,
      addTextBlockWithEdge: state.addTextBlockWithEdge,
      addImageBlockWithEdge: state.addImageBlockWithEdge,
      setContextMenu: state.setContextMenu,
      setEdgeDropMenu: state.setEdgeDropMenu,
      closeMenus: state.closeMenus,
      setPendingCenterNodeId: state.setPendingCenterNodeId,
    })),
  );

  // Pending edge state (frozen edge shown until user clicks)
  const [pendingEdge, setPendingEdge] = useState<PendingEdge | null>(null);

  // Center viewport on newly created block
  useEffect(() => {
    console.log("pendingCenterNodeId:", pendingCenterNodeId);
    if (pendingCenterNodeId) {
      const node = nodes.find((n) => n.id === pendingCenterNodeId);
      if (node) {
        // Calculate center of the block
        const nodeWidth = node.measured?.width ?? defaultBlockSize.width;
        const nodeHeight = node.measured?.height ?? defaultBlockSize.height;
        const centerX = node.position.x + nodeWidth / 2;
        const centerY = node.position.y + nodeHeight / 2;

        // Center viewport on the block with smooth animation
        setCenter(centerX, centerY, { duration: 300, zoom: 1.5 });
      }
      // Clear the pending center
      setPendingCenterNodeId(null);
    }
  }, [pendingCenterNodeId, nodes, defaultBlockSize, setCenter, setPendingCenterNodeId]);

  // Handle selection changes
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      setSelectedNodes(selectedNodes.map((n) => n.id));
    },
    [setSelectedNodes],
  );

  // Handle context menu
  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowPosition,
      });
    },
    [screenToFlowPosition, setContextMenu],
  );

  // Close context menu when clicking elsewhere
  const onPaneClick = useCallback(() => {
    closeMenus();
    setPendingEdge(null);
  }, [closeMenus]);

  // Update viewport in store when user stops moving the canvas
  const onMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      setViewport(viewport);
    },
    [setViewport],
  );

  // Track when a connection starts
  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: { nodeId: string | null }) => {
      connectingNodeId.current = params.nodeId;
    },
    [],
  );

  // Handle when a connection ends (either connected or dropped on empty space)
  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      // Check if we dropped on empty space (not on a handle)
      const targetIsPane = (event.target as Element)?.classList?.contains(
        "react-flow__pane",
      );

      if (targetIsPane && connectingNodeId.current) {
        // Get the mouse position
        const mouseEvent = event as MouseEvent;
        const touchEvent = event as TouchEvent;

        const clientX =
          mouseEvent.clientX ?? touchEvent.changedTouches?.[0]?.clientX;
        const clientY =
          mouseEvent.clientY ?? touchEvent.changedTouches?.[0]?.clientY;

        if (clientX !== undefined && clientY !== undefined) {
          const flowPosition = screenToFlowPosition({
            x: clientX,
            y: clientY,
          });

          // Find the source node to get its handle position
          const sourceNode = nodes.find(
            (n) => n.id === connectingNodeId.current,
          );
          if (sourceNode) {
            // Calculate source handle position (right side of node)
            // Node width is 280px, handle is centered vertically
            const nodeWidth = sourceNode.measured?.width ?? 280;
            const nodeHeight = sourceNode.measured?.height ?? 150;
            const sourceX = sourceNode.position.x + nodeWidth;
            const sourceY = sourceNode.position.y + nodeHeight / 2;

            // Set the pending edge (frozen edge overlay)
            setPendingEdge({
              sourceX,
              sourceY,
              targetX: flowPosition.x,
              targetY: flowPosition.y,
            });
          }

          setEdgeDropMenu({
            x: clientX,
            y: clientY,
            flowPosition,
            sourceNodeId: connectingNodeId.current,
          });
        }
      }

      connectingNodeId.current = null;
    },
    [screenToFlowPosition, nodes, setEdgeDropMenu],
  );

  // Handle context menu actions
  const handleAddTextBlock = useCallback(() => {
    if (contextMenu) {
      addTextBlock(contextMenu.flowPosition);
      setContextMenu(null);
    }
  }, [contextMenu, addTextBlock, setContextMenu]);

  const handleAddImageBlock = useCallback(() => {
    if (contextMenu) {
      addImageBlock(contextMenu.flowPosition);
      setContextMenu(null);
    }
  }, [contextMenu, addImageBlock, setContextMenu]);

  // Handle edge drop menu actions
  const handleEdgeDropAddTextBlock = useCallback(() => {
    if (edgeDropMenu) {
      const centeredPosition = {
        x: edgeDropMenu.flowPosition.x + defaultBlockSize.width / 2,
        y: edgeDropMenu.flowPosition.y,
      };
      addTextBlockWithEdge(centeredPosition, edgeDropMenu.sourceNodeId);
      setEdgeDropMenu(null);
      setPendingEdge(null);
    }
  }, [edgeDropMenu, addTextBlockWithEdge, setEdgeDropMenu]);

  const handleEdgeDropAddImageBlock = useCallback(() => {
    if (edgeDropMenu) {
      const centeredPosition = {
        x: edgeDropMenu.flowPosition.x + defaultBlockSize.width / 2,
        y: edgeDropMenu.flowPosition.y,
      };
      addImageBlockWithEdge(centeredPosition, edgeDropMenu.sourceNodeId);
      setEdgeDropMenu(null);
      setPendingEdge(null);
    }
  }, [edgeDropMenu, addImageBlockWithEdge, setEdgeDropMenu]);

  // Default edge options
  const defaultEdgeOptions = {
    type: "animated",
    animated: true,
  };

  // MiniMap node color function
  const getNodeColor = useCallback((node: Node) => {
    if (node.type === "textBlock") return "var(--accent-primary)";
    if (node.type === "imageBlock") return "var(--accent-secondary)";
    return "var(--border-default)";
  }, []);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onSelectionChange={onSelectionChange}
        onContextMenu={onContextMenu}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={3.0}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode={["Shift", "Meta"]}
        selectionOnDrag
        panOnDrag={[1, 2]} // Middle and right mouse button
        panOnScroll={true} // Enable two-finger trackpad panning
        selectionMode={SelectionMode.Partial}
        proOptions={{ hideAttribution: true }}
        snapToGrid={true}
        snapGrid={[20, 20]}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#888888"
        />
        <Controls
          showZoom
          showFitView
          showInteractive={false}
          position="bottom-left"
        />
        <MiniMap
          nodeColor={getNodeColor}
          maskColor="rgba(0, 0, 0, 0.8)"
          position="bottom-right"
        />
      </ReactFlow>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onAddTextBlock={handleAddTextBlock}
          onAddImageBlock={handleAddImageBlock}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Edge Drop Menu */}
      {edgeDropMenu && (
        <ContextMenu
          x={edgeDropMenu.x}
          y={edgeDropMenu.y}
          onAddTextBlock={handleEdgeDropAddTextBlock}
          onAddImageBlock={handleEdgeDropAddImageBlock}
          onClose={() => {
            setEdgeDropMenu(null);
            setPendingEdge(null);
          }}
        />
      )}

      {/* Pending Edge SVG Overlay - frozen edge until user clicks */}
      {pendingEdge && <PendingEdgeOverlay pendingEdge={pendingEdge} />}
    </div>
  );
}
