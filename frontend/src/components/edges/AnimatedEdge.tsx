import { memo } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

function AnimatedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {selected && (
        <BaseEdge
          path={edgePath}
          style={{
            stroke: "var(--accent-primary)",
            strokeWidth: 6,
            filter: "blur(4px)",
            opacity: 0.5,
          }}
        />
      )}

      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? "var(--accent-primary)" : "var(--border-default)",
          strokeWidth: 2,
          transition: "stroke 0.2s ease",
          ...style,
        }}
      />

      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <marker
            id={`arrow-${id}`}
            markerWidth="12"
            markerHeight="12"
            refX="8"
            refY="6"
            orient="auto"
          >
            <path
              d="M2,2 L10,6 L2,10 L4,6 Z"
              fill={
                selected ? "var(--accent-primary)" : "var(--border-default)"
              }
              style={{ transition: "fill 0.2s ease" }}
            />
          </marker>
        </defs>
      </svg>
    </>
  );
}

export const AnimatedEdge = memo(AnimatedEdgeComponent);
