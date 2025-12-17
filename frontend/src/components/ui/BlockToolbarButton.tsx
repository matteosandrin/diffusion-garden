import { type ReactNode, useState } from "react";

interface BlockToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}

export function BlockToolbarButton({
  onClick,
  disabled = false,
  title,
  children,
}: BlockToolbarButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={disabled}
        className="p-1.5 rounded transition-all text-white disabled:opacity-20 bg-transparent hover:bg-white/10 disabled:hover:bg-transparent"
        onMouseEnter={() => !disabled && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
      </button>

      {isHovered && !disabled && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 rounded text-xs whitespace-nowrap z-50 animate-fade-in pointer-events-none"
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
