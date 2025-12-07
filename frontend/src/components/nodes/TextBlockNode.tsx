import { memo, useCallback, useRef } from "react";
import { type NodeProps } from "@xyflow/react";
import {
  Image,
  ListChevronsUpDown,
  SeparatorHorizontal,
  Shuffle,
  RefreshCw,
} from "lucide-react";
import type { TextBlockData, TextModel } from "../../types";
import { useCanvasStore } from "../../store/canvasStore";
import { jobsApi } from "../../api/client";
import { BaseBlockNode } from "./BaseBlockNode";
import { BlockToolbarButton } from "../ui/BlockToolbarButton";
import { AutoResizeTextarea } from "../ui/AutoResizeTextarea";
import { splitContent } from "../../utils/splitContent";

type PromptKey = "expand" | "twist" | "reimagine";

function TextBlockNodeComponent({ id, data, selected }: NodeProps) {
  const blockData = data as unknown as TextBlockData;
  const {
    updateBlockData,
    updateBlockStatus,
    addTextBlock,
    addImageBlock,
    getInputBlockContent,
    models,
  } = useCanvasStore();

  const streamCleanupFunctionRef = useRef<(() => void) | null>(null);

  const handleContentChange = useCallback(
    (value: string) => {
      updateBlockData(id, { content: value });
    },
    [id, updateBlockData],
  );

  const handlePromptChange = useCallback(
    (value: string) => {
      updateBlockData(id, { prompt: value });
    },
    [id, updateBlockData],
  );

  const handleModelChange = useCallback(
    (model: string) => {
      updateBlockData(id, { model: model as TextModel });
    },
    [id, updateBlockData],
  );

  const createConnectedBlock = useCallback(
    (promptKey: PromptKey | "image") => {
      if (!blockData.content.trim()) return;

      const store = useCanvasStore.getState();
      const currentNode = store.nodes.find((n) => n.id === id);
      if (!currentNode) return;

      const currentNodeWidth = currentNode.width || 280;
      const newPosition = {
        x: currentNode.position.x + currentNodeWidth + 60,
        y: currentNode.position.y,
      };

      const newBlockId =
        promptKey === "image"
          ? addImageBlock(
              newPosition,
              {
                source: "generated",
                status: "idle",
                sourceBlockId: id,
              },
              {
                upperLeftCorner: true,
              },
            )
          : addTextBlock(
              newPosition,
              {
                prompt: store.prompts[promptKey],
                sourceBlockId: id,
                autoRun: true,
              },
              {
                upperLeftCorner: true,
              },
            );

      store.onConnect({
        source: id,
        target: newBlockId,
        sourceHandle: null,
        targetHandle: null,
      });
    },
    [id, blockData.content, addTextBlock, addImageBlock],
  );

  const handleExpand = useCallback(
    () => createConnectedBlock("expand"),
    [createConnectedBlock],
  );

  const handleTwist = useCallback(
    () => createConnectedBlock("twist"),
    [createConnectedBlock],
  );

  const handleReimagine = useCallback(
    () => createConnectedBlock("reimagine"),
    [createConnectedBlock],
  );

  const handleGenerateImage = useCallback(
    () => createConnectedBlock("image"),
    [createConnectedBlock],
  );

  const handleRun = useCallback(async () => {
    const promptToRun = blockData.prompt?.trim();
    if (!promptToRun) return;

    if (streamCleanupFunctionRef.current) {
      streamCleanupFunctionRef.current();
      streamCleanupFunctionRef.current = null;
    }

    updateBlockStatus(id, "running");
    updateBlockData(id, { content: "" });

    try {
      const inputContentItems = getInputBlockContent(id);
      const { jobId } = await jobsApi.createTextJob(
        id,
        promptToRun,
        inputContentItems,
        blockData.model,
      );
      updateBlockData(id, { jobId });
      streamCleanupFunctionRef.current = jobsApi.subscribeToJob(jobId, {
        onChunk: (text) => {
          updateBlockData(id, { content: text });
        },
        onDone: (result) => {
          updateBlockData(id, {
            content: result.text,
            jobId: undefined,
          });
          updateBlockStatus(id, "success");
          streamCleanupFunctionRef.current = null;
        },
        onError: (error) => {
          updateBlockData(id, { jobId: undefined });
          updateBlockStatus(id, "error", error);
          streamCleanupFunctionRef.current = null;
        },
        onCancelled: () => {
          updateBlockData(id, { jobId: undefined });
          updateBlockStatus(id, "idle");
          streamCleanupFunctionRef.current = null;
        },
      });
    } catch (error) {
      updateBlockData(id, { jobId: undefined });
      updateBlockStatus(
        id,
        "error",
        error instanceof Error ? error.message : "Failed to run",
      );
    }
  }, [
    id,
    blockData.prompt,
    blockData.model,
    updateBlockStatus,
    updateBlockData,
    getInputBlockContent,
  ]);

  const handleCancel = useCallback(async () => {
    if (blockData.jobId) {
      try {
        await jobsApi.cancelJob(blockData.jobId);
      } catch (error) {
        // Canceling is best effort, so we log the error but don't interrupt
        console.log(error);
      }
    }
    if (streamCleanupFunctionRef.current) {
      streamCleanupFunctionRef.current();
      streamCleanupFunctionRef.current = null;
    }
    updateBlockData(id, { jobId: undefined });
    updateBlockStatus(id, "idle");
  }, [id, blockData.jobId, updateBlockData, updateBlockStatus]);

  const handleSplit = useCallback(() => {
    const items = splitContent(blockData.content);
    if (items.length < 2) return;

    const store = useCanvasStore.getState();
    const currentNode = store.nodes.find((n) => n.id === id);
    if (!currentNode) return;

    const currentNodeWidth = currentNode.width || 280;
    const currentNodeHeight = currentNode.height || 280;

    items.forEach((item, index) => {
      const i = index - Math.ceil(items.length / 2) + 1;
      const position = {
        x: currentNode.position.x + currentNodeWidth + 60,
        y: currentNode.position.y + i * (currentNodeHeight + 60),
      };
      const newBlockId = addTextBlock(
        position,
        {
          content: item,
          sourceBlockId: id,
        },
        {
          upperLeftCorner: true,
          centerViewportToBlock: false,
        },
      );

      store.onConnect({
        source: id,
        target: newBlockId,
        sourceHandle: null,
        targetHandle: null,
      });
    });
  }, [id, blockData.content, addTextBlock]);

  const handleAutoRunComplete = useCallback(() => {
    updateBlockData(id, { autoRun: false });
  }, [id, updateBlockData]);

  return (
    <BaseBlockNode
      id={id}
      blockType="text"
      selected={selected}
      status={blockData.status}
      error={blockData.error}
      style={{
        accentColor: "var(--accent-primary)",
      }}
      ui={{
        toolbarButtons: (
          <>
            <BlockToolbarButton
              onClick={handleExpand}
              disabled={
                blockData.status === "running" || !blockData.content.trim()
              }
              title="Expand"
            >
              <ListChevronsUpDown size={16} />
            </BlockToolbarButton>
            <BlockToolbarButton
              onClick={handleTwist}
              disabled={
                blockData.status === "running" || !blockData.content.trim()
              }
              title="Twist"
            >
              <Shuffle size={16} />
            </BlockToolbarButton>
            <BlockToolbarButton
              onClick={handleReimagine}
              disabled={
                blockData.status === "running" || !blockData.content.trim()
              }
              title="Reimagine"
            >
              <RefreshCw size={16} />
            </BlockToolbarButton>
            <BlockToolbarButton
              onClick={handleSplit}
              disabled={
                blockData.status === "running" ||
                splitContent(blockData.content).length < 2
              }
              title="Split"
            >
              <SeparatorHorizontal size={16} />
            </BlockToolbarButton>
            <BlockToolbarButton
              onClick={handleGenerateImage}
              disabled={
                blockData.status === "running" || !blockData.content.trim()
              }
              title="Generate image"
            >
              <Image size={16} />
            </BlockToolbarButton>
          </>
        ),
      }}
      model={{
        models: models.textModels,
        selectedModel: blockData.model,
        onModelChange: handleModelChange,
      }}
      run={{
        disabled: !blockData.prompt?.trim(),
        title: "Run prompt",
        onRun: handleRun,
        onCancel: handleCancel,
      }}
      prompt={{
        value: blockData.prompt,
        placeholder: "Let your prompt imagination run wild...",
        onChange: handlePromptChange,
      }}
      autoRun={{
        enabled: blockData.autoRun,
        onComplete: handleAutoRunComplete,
      }}
    >
      {/* Content section */}
      <div
        className={`h-full px-3 py-2 border-b ${selected ? "nowheel nodrag" : ""}`}
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <AutoResizeTextarea
          value={blockData.content}
          onChange={handleContentChange}
          rows={3}
          height="100%"
          style={{ color: "var(--text-primary)" }}
          autoScrollToBottom={blockData.status === "running"}
        />
      </div>
    </BaseBlockNode>
  );
}

export const TextBlockNode = memo(TextBlockNodeComponent);
