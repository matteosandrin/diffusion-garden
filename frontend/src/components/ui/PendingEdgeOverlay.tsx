import { memo } from "react";
import { getBezierPath, Position, useViewport } from "@xyflow/react";

export interface PendingEdge {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

interface PendingEdgeOverlayProps {
  pendingEdge: PendingEdge;
}

function PendingEdgeOverlayComponent({ pendingEdge }: PendingEdgeOverlayProps) {
  const viewport = useViewport();

  const [edgePath] = getBezierPath({
    sourceX: pendingEdge.sourceX,
    sourceY: pendingEdge.sourceY,
    sourcePosition: Position.Right,
    targetX: pendingEdge.targetX,
    targetY: pendingEdge.targetY,
    targetPosition: Position.Left,
  });

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <g
        transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
      >
        <path
          d={edgePath}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth={2}
          strokeDasharray="5,5"
          style={{
            animation: "pendingEdgeDash 0.5s linear infinite",
          }}
        />
      </g>
      <style>{`
        @keyframes pendingEdgeDash {
          to {
            stroke-dashoffset: -10;
          }
        }
      `}</style>
    </svg>
  );
}

export const PendingEdgeOverlay = memo(PendingEdgeOverlayComponent);
