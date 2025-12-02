import { useCallback, useRef, useState } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '../store/canvasStore';
import { TextBlockNode } from './nodes/TextBlockNode';
import { ImageBlockNode } from './nodes/ImageBlockNode';
import { AnimatedEdge } from './edges/AnimatedEdge';
import { ContextMenu } from './ui/ContextMenu';

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
  const { screenToFlowPosition } = useReactFlow();
  
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodes,
    setViewport,
    addTextBlock,
    addImageBlock,
  } = useCanvasStore();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    flowPosition: { x: number; y: number };
  } | null>(null);

  // Handle selection changes
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      setSelectedNodes(selectedNodes.map((n) => n.id));
    },
    [setSelectedNodes]
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
    [screenToFlowPosition]
  );

  // Close context menu when clicking elsewhere
  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Update viewport in store when user stops moving the canvas
  const onMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      setViewport(viewport);
    },
    [setViewport]
  );

  // Handle context menu actions
  const handleAddTextBlock = useCallback(() => {
    if (contextMenu) {
      addTextBlock(contextMenu.flowPosition);
      setContextMenu(null);
    }
  }, [contextMenu, addTextBlock]);

  const handleAddImageBlock = useCallback(() => {
    if (contextMenu) {
      addImageBlock(contextMenu.flowPosition);
      setContextMenu(null);
    }
  }, [contextMenu, addImageBlock]);

  // Default edge options
  const defaultEdgeOptions = {
    type: 'animated',
    animated: true,
  };

  // MiniMap node color function
  const getNodeColor = useCallback((node: Node) => {
    if (node.type === 'textBlock') return 'var(--accent-primary)';
    if (node.type === 'imageBlock') return 'var(--accent-secondary)';
    return 'var(--border-default)';
  }, []);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
        maxZoom={2.0}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Shift', 'Meta']}
        selectionOnDrag
        panOnDrag={[1, 2]} // Middle and right mouse button
        panOnScroll={true} // Enable two-finger trackpad panning
        selectionMode={SelectionMode.Partial}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--border-default)"
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
    </div>
  );
}
