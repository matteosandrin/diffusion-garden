import { memo, useCallback } from "react";
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
import { toolsApi } from "../../api/client";
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

  const handleExecute = useCallback(async () => {
    const promptToExecute = blockData.prompt?.trim();
    if (!promptToExecute) return;

    updateBlockStatus(id, "running");

    try {
      const inputContentItems = getInputBlockContent(id);

      const response = await toolsApi.generateText(
        promptToExecute,
        inputContentItems,
        blockData.model,
      );

      updateBlockData(id, { content: response.result });
      updateBlockStatus(id, "success");
    } catch (error) {
      updateBlockStatus(
        id,
        "error",
        error instanceof Error ? error.message : "Failed to execute",
      );
    }
  }, [id, blockData, updateBlockStatus, updateBlockData, getInputBlockContent]);

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
      selected={selected}
      status={blockData.status}
      error={blockData.error}
      accentColor="var(--accent-primary)"
      blockType="text"
      toolbarButtons={
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
      }
      models={models.textModels}
      selectedModel={blockData.model}
      onModelChange={handleModelChange}
      onPlay={handleExecute}
      runButtonDisabled={!blockData.prompt?.trim() && !blockData.content.trim()}
      runButtonTitle="Execute prompt"
      prompt={blockData.prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder="Let your prompt imagination run wild..."
      autoRun={blockData.autoRun}
      onAutoRunComplete={handleAutoRunComplete}
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
        />
      </div>
    </BaseBlockNode>
  );
}

export const TextBlockNode = memo(TextBlockNodeComponent);
