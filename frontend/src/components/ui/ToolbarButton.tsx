import { useState, type ReactNode } from "react";

interface ToolbarButtonProps {
  onClick: () => void;
  icon: ReactNode;
  label?: string;
  title?: string;
}

export function ToolbarButton({
  onClick,
  icon,
  label,
  title,
}: ToolbarButtonProps) {
  const isIconOnly = !label;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`flex items-center gap-2 rounded-lg text-sm font-medium transition-all ${
          isIconOnly ? "p-2" : "px-3 py-1.5"
        }`}
        style={{
          color: isIconOnly ? "var(--text-secondary)" : "var(--text-primary)",
        }}
        onMouseEnter={(e) => {
          setIsHovered(true);
          e.currentTarget.style.background = "var(--bg-card-hover)";
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          setIsHovered(false);
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = isIconOnly
            ? "var(--text-secondary)"
            : "var(--text-primary)";
        }}
        title={title}
      >
        {icon}
        {label}
      </button>
      {isHovered && title && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-4 px-2 py-1 rounded text-xs whitespace-nowrap z-50 animate-fade-in pointer-events-none"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {title}
        </div>
      )}
    </div>
  );
}
