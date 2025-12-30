import {
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Trash2,
  ArrowUp,
  Loader2,
  ChevronDown,
  TriangleAlert,
} from "lucide-react";
import type { BlockStatus } from "../../types";
import { useCanvasStore } from "../../store/canvasStore";
import { BlockToolbarButton } from "../ui/BlockToolbarButton";
import {
  AutoResizeTextarea,
  type AutoResizeTextareaRef,
} from "../ui/AutoResizeTextarea";

export interface ModelOption {
  id: string;
  label: string;
}

export interface RunConfig {
  disabled?: boolean;
  title?: string;
  onRun?: () => void;
}

export interface PromptConfig {
  value?: string;
  placeholder?: string;
  readonly?: boolean;
  onChange?: (value: string) => void;
}

export interface ModelConfig {
  models?: ModelOption[];
  selectedModel?: string;
  onModelChange?: (model: string) => void;
}

export interface AutoRunConfig {
  enabled?: boolean;
  onComplete?: () => void;
}

export interface StyleConfig {
  accentColor?: string;
}

export interface UIConfig {
  toolbarButtons?: ReactNode;
  footerLeftContent?: ReactNode;
}

interface BaseBlockNodeProps {
  id: string;
  blockType: "text" | "image";
  selected: boolean;
  status: BlockStatus;
  error?: string;
  children: ReactNode;
  run?: RunConfig;
  prompt?: PromptConfig;
  model?: ModelConfig;
  autoRun?: AutoRunConfig;
  style?: StyleConfig;
  ui?: UIConfig;
  hasContent?: boolean;
}

export function BaseBlockNode({
  id,
  blockType,
  selected,
  status,
  error,
  children,
  run,
  prompt,
  model,
  autoRun,
  style,
  ui,
  hasContent = false,
}: BaseBlockNodeProps) {
  const {
    onRun,
    disabled: runButtonDisabled,
    title: runButtonTitle = "Run",
  } = run || {};
  const {
    value: promptValue,
    onChange: onPromptChange,
    placeholder: promptPlaceholder = "Enter your prompt here...",
    readonly: promptReadonly = false,
  } = prompt || {};
  const { models, selectedModel, onModelChange } = model || {};
  const { enabled: autoRunEnabled, onComplete: onAutoRunComplete } =
    autoRun || {};
  const { accentColor = "var(--accent-primary)" } = style || {};
  const { toolbarButtons, footerLeftContent } = ui || {};
  const {
    deleteNode,
    selectedNodeIds,
    nodesToRun,
    requestRunForNodes,
    clearNodeFromRunQueue,
  } = useCanvasStore();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const hasAutoRunTriggered = useRef(false);
  const promptTextareaRef = useRef<AutoResizeTextareaRef>(null);

  // Focus prompt textarea when block becomes selected
  useEffect(() => {
    if (selected && promptTextareaRef.current) {
      // Small delay to ensure the prompt bubble animation has started
      const timeoutId = setTimeout(() => {
        promptTextareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [selected]);

  useEffect(() => {
    if (
      autoRunEnabled &&
      !hasAutoRunTriggered.current &&
      status === "idle" &&
      onRun
    ) {
      hasAutoRunTriggered.current = true;
      // Notify parent to clear the autoRun flag
      onAutoRunComplete?.();
      onRun();
    }
  }, [autoRunEnabled, status, onRun, onAutoRunComplete]);

  useEffect(() => {
    if (nodesToRun.includes(id) && status !== "running" && onRun) {
      clearNodeFromRunQueue(id);
      onRun();
    }
  }, [id, nodesToRun, status, onRun, clearNodeFromRunQueue]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  const handleModelSelect = useCallback(
    (model: string) => {
      onModelChange?.(model);
      setIsModelDropdownOpen(false);
    },
    [onModelChange],
  );

  const handleRunClick = useCallback(() => {
    if (!onRun) return;

    const isMultiSelect =
      selectedNodeIds.length > 1 && selectedNodeIds.includes(id);

    if (isMultiSelect) {
      requestRunForNodes(selectedNodeIds);
    } else {
      onRun();
    }
  }, [id, onRun, selectedNodeIds, requestRunForNodes]);

  const getBoxShadow = () => {
    return "var(--shadow-card)";
  };

  const runningGlowStyle =
    status === "running"
      ? {
          animation: "borderGlow 1s ease-in-out infinite",
        }
      : {};

  return (
    <div className="text-xs">
      <style>{`
        @keyframes borderGlow {
          0%, 100% {
            box-shadow: 
              var(--shadow-card),
              0 0 15px 0 rgba(255, 255, 255, 0.15),
              0 0 30px 0 rgba(255, 255, 255, 0.08),
              inset 0 0 20px 0 rgba(255, 255, 255, 0.02);
          }
          50% {
            box-shadow: 
              var(--shadow-card),
              0 0 25px 2px rgba(255, 255, 255, 0.25),
              0 0 50px 5px rgba(255, 255, 255, 0.12),
              inset 0 0 30px 0 rgba(255, 255, 255, 0.04);
          }
        }
      `}</style>
      {/* Toolbar - slides down when selected */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-full flex items-center gap-1 px-2 py-1 rounded-lg z-10 transition-all duration-300 ease-out"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-card)",
          transform: selected ? "translateY(-0.5rem)" : "translateY(1rem)",
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? "auto" : "none",
        }}
      >
        {toolbarButtons}
        <BlockToolbarButton
          onClick={handleDelete}
          disabled={status === "running"}
          title="Delete"
        >
          <Trash2 size={16} />
        </BlockToolbarButton>
      </div>
      {/* Block type label */}
      {blockType && (
        <div
          className="absolute -top-5 left-0 text-xs px-1.5 py-0.5 rounded"
          style={{
            color: "var(--text-muted)",
            background: "transparent",
            fontSize: "10px",
            textTransform: "capitalize",
            pointerEvents: "none",
          }}
        >
          {blockType}
        </div>
      )}

      <div
        className={`relative w-[280px] ${blockType === "text" || (!hasContent && blockType === "image") ? "h-[280px]" : ""} rounded-xl transition-all duration-200 overflow-hidden flex flex-col`}
        style={{
          background: "var(--bg-card)",
          border: `1px solid ${status === "running" ? "rgba(255, 255, 255, 0.4)" : selected ? accentColor : "var(--border-subtle)"}`,
          boxShadow: getBoxShadow(),
          ...runningGlowStyle,
        }}
      >
        {/* Main content */}
        <div className="grow">{children}</div>

        {/* Footer with run button */}
        {(onRun || footerLeftContent || models) && (
          <div
            className="flex items-center justify-between px-3 py-2 border-t h-[45px]"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {/* Left content - model selector or custom content */}
            <div>
              {models && models.length > 0 ? (
                <div className="relative">
                  <button
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                    style={{
                      background: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {models.find((m) => m.id === selectedModel)?.label ||
                      selectedModel}
                    <ChevronDown size={12} />
                  </button>

                  {isModelDropdownOpen && (
                    <div
                      className="absolute bottom-full left-0 mb-1 py-1 rounded-lg z-10 min-w-fit"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        boxShadow: "var(--shadow-card)",
                      }}
                    >
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleModelSelect(model.id)}
                          className="w-full px-3 py-1.5 text-left text-xs transition-colors whitespace-nowrap"
                          style={{
                            color:
                              selectedModel === model.id
                                ? accentColor
                                : "var(--text-secondary)",
                            background:
                              selectedModel === model.id
                                ? "var(--bg-card-hover)"
                                : "transparent",
                          }}
                        >
                          {model.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                footerLeftContent || null
              )}
            </div>

            {/* Run button */}
            {onRun && (
              <button
                onClick={handleRunClick}
                disabled={status === "running" || runButtonDisabled}
                className="flex items-center gap-1 px-1 py-1 rounded-full text-xs transition-all disabled:opacity-30"
                style={{
                  background: accentColor,
                  color: "black",
                }}
                title={runButtonTitle}
              >
                {status === "running" ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <ArrowUp size={20} strokeWidth={3} />
                )}
              </button>
            )}
          </div>
        )}

        {/* Error message */}
        {status === "error" && error && (
          <div
            className="px-3 py-2 text-xs border-t flex items-center gap-2"
            style={{
              borderColor: "var(--accent-error)",
              color: "var(--accent-error)",
              background: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <TriangleAlert size={12} className="inline" /> {error}
          </div>
        )}
      </div>

      {/* Prompt bubble - slides out from under the block when selected */}
      {(promptValue !== undefined || onPromptChange) && (
        <div
          className="nowheel nodrag absolute left-0 top-full -mt-8 w-full px-3 pt-8 pb-2 rounded-b-xl transition-all duration-300 ease-out"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderTop: "none",
            boxShadow: "var(--shadow-card)",
            transform: selected ? "translateY(0.5rem)" : "translateY(-100%)",
            opacity: selected ? 1 : 0,
            pointerEvents: selected ? "auto" : "none",
            zIndex: -1,
          }}
        >
          <div className="relative">
            <AutoResizeTextarea
              ref={promptTextareaRef}
              value={promptValue || ""}
              onChange={(value) => onPromptChange?.(value)}
              rows={2}
              readOnly={promptReadonly}
              disabled={promptReadonly}
              minHeight="45px"
              maxHeight="120px"
              style={{
                color: promptReadonly
                  ? "var(--text-muted)"
                  : "var(--text-primary)",
                cursor: promptReadonly ? "default" : "text",
              }}
              className="nowheel nodrag"
            />
            {/* Shimmer placeholder overlay */}
            {!promptValue && !promptReadonly && (
              <div
                className="shimmer-placeholder-overlay absolute -top-px left-0 right-0 text-xs pr-1"
                style={{
                  lineHeight: "1.5",
                }}
              >
                {promptPlaceholder}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input handle */}
      <Handle type="target" position={Position.Left} />

      {/* Output handle */}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
