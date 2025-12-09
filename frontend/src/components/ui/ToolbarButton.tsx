import { type ReactNode } from 'react';

interface ToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}

export function ToolbarButton({
  onClick,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded transition-all text-white disabled:opacity-20 bg-transparent hover:bg-white/10 disabled:hover:bg-transparent"
      title={title}
    >
      {children}
    </button>
  );
}

