import { memo, useCallback, useState, useRef, useEffect } from "react";
import { type NodeProps } from "@xyflow/react";
import { PilcrowRight, Upload, LayoutGrid, Braces } from "lucide-react";
import type { ImageBlockData, ImageModel } from "../../types";
import { useCanvasStore } from "../../store/canvasStore";
import { toolsApi, imageApi } from "../../api/client";
import { BaseBlockNode } from "./BaseBlockNode";
import { BlockToolbarButton } from "../ui/BlockToolbarButton";

function ImageBlockNodeComponent({ id, data, selected }: NodeProps) {
  const blockData = data as unknown as ImageBlockData;
  const {
    updateBlockData,
    updateBlockStatus,
    addTextBlock,
    addImageBlock,
    getInputBlockContent,
    getInputBlocks,
    models,
  } = useCanvasStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptFromInputRef = useRef(false);
  const lastInputContentRef = useRef<string>("");
  const hasContent = !!blockData.imageUrl;

  const inputContentItems = getInputBlockContent(id);
  const inputContent =
    inputContentItems.length > 0
      ? inputContentItems
          .filter((item) => item.type === "text")
          .map((item) => item.content)
          .join("\n\n")
          .trim()
      : "";

  useEffect(() => {
    const hasTextualInput = inputContentItems.some(
      (item) => item.type === "text",
    );
    if (hasTextualInput) {
      if (inputContent !== lastInputContentRef.current) {
        updateBlockData(id, { prompt: inputContent });
        lastInputContentRef.current = inputContent;
        promptFromInputRef.current = true;
      }
    } else {
      if (promptFromInputRef.current) {
        updateBlockData(id, { prompt: "" });
        promptFromInputRef.current = false;
        lastInputContentRef.current = "";
      }
    }
  }, [id, inputContentItems, inputContent, updateBlockData]);

  const promptFromInput = inputContentItems.some(
    (item) => item.type === "text",
  );

  const handlePromptChange = useCallback(
    (value: string) => {
      const hasTextualInput = inputContentItems.some(
        (item) => item.type === "text",
      );
      if (!hasTextualInput) {
        updateBlockData(id, { prompt: value });
        promptFromInputRef.current = false;
      }
    },
    [id, inputContentItems, updateBlockData],
  );

  const handleModelChange = useCallback(
    (model: string) => {
      updateBlockData(id, { model: model as ImageModel });
    },
    [id, updateBlockData],
  );

  const handleGenerate = useCallback(async () => {
    if (!blockData.prompt?.trim()) return;

    updateBlockStatus(id, "running");

    try {
      const response = await toolsApi.generateImage(
        blockData.prompt,
        inputContentItems,
        blockData.model as ImageModel,
        blockData.variation || false,
      );
      updateBlockData(id, {
        imageUrl: response.imageUrl,
        imageId: response.imageId,
        source: "generated",
      });
      updateBlockStatus(id, "success");
    } catch (error) {
      updateBlockStatus(
        id,
        "error",
        error instanceof Error ? error.message : "Failed to generate image",
      );
    }
  }, [
    id,
    blockData.prompt,
    inputContentItems,
    updateBlockStatus,
    updateBlockData,
  ]);

  const handleDescribe = useCallback(async () => {
    if (!blockData.imageUrl) return;

    const store = useCanvasStore.getState();
    const currentNode = store.nodes.find((n) => n.id === id);
    if (!currentNode) return;

    const currentNodeWidth = currentNode.width || 280;

    const newBlockId = addTextBlock(
      {
        x: currentNode.position.x + currentNodeWidth + 60,
        y: currentNode.position.y,
      },
      {
        prompt: store.prompts.describe,
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
  }, [id, blockData.imageUrl, addTextBlock]);

  const handleImageToJson = useCallback(async () => {
    if (!blockData.imageUrl) return;

    const store = useCanvasStore.getState();
    const currentNode = store.nodes.find((n) => n.id === id);
    if (!currentNode) return;

    const currentNodeWidth = currentNode.width || 280;

    const newBlockId = addTextBlock(
      {
        x: currentNode.position.x + currentNodeWidth + 60,
        y: currentNode.position.y,
      },
      {
        prompt: store.prompts.image_to_json,
        model: models.textModels.find((model) => model.id === "gpt-5.1")?.id,
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
  }, [id, blockData.imageUrl, addTextBlock]);

  const handleVariations = useCallback(() => {
    if (!promptFromInput) return;

    const store = useCanvasStore.getState();
    const currentNode = store.nodes.find((n) => n.id === id);
    if (!currentNode) return;

    const inputBlocks = getInputBlocks(id);
    const inputTextBlocks = inputBlocks.filter(
      (block) => block.data.type === "text",
    );

    if (inputTextBlocks.length === 0) return;

    const currentNodeWidth = currentNode.width || 280;
    const currentNodeHeight = Math.max(currentNode.height || 280, 280);
    const blockSpacing = 60;

    const baseX = currentNode.position.x + currentNodeWidth + blockSpacing;
    const baseY = currentNode.position.y;

    const gridPositions = [
      { x: baseX, y: baseY },
      { x: baseX + currentNodeWidth + blockSpacing, y: baseY },
      { x: baseX, y: baseY + currentNodeHeight + blockSpacing },
      {
        x: baseX + currentNodeWidth + blockSpacing,
        y: baseY + currentNodeHeight + blockSpacing,
      },
    ];

    const newBlockIds = gridPositions.map((position) => {
      return addImageBlock(
        position,
        {
          model: blockData.model || models.defaultImageModel,
          source: "generated",
          status: "idle",
          autoRun: true,
          prompt: blockData.prompt, // Pass prompt directly for autoRun to work
          variation: true,
        },
        {
          upperLeftCorner: true,
          centerViewportToBlock: false,
        },
      );
    });

    // Connect each new image block to all input text blocks
    newBlockIds.forEach((newBlockId) => {
      inputTextBlocks.forEach((inputBlock) => {
        store.onConnect({
          source: inputBlock.id,
          target: newBlockId,
          sourceHandle: null,
          targetHandle: null,
        });
      });
    });
  }, [
    id,
    promptFromInput,
    blockData.model,
    blockData.prompt,
    models.defaultImageModel,
    getInputBlocks,
    addImageBlock,
  ]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        updateBlockStatus(id, "error", "Please upload an image file");
        return;
      }

      updateBlockStatus(id, "running");

      try {
        const result = await imageApi.upload(file);
        updateBlockData(id, {
          imageUrl: result.imageUrl,
          imageId: result.imageId,
          source: "upload",
        });
        updateBlockStatus(id, "success");
      } catch (error) {
        updateBlockStatus(
          id,
          "error",
          error instanceof Error ? error.message : "Upload failed",
        );
      }
    },
    [id, updateBlockData, updateBlockStatus],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload],
  );

  const handleAutoRunComplete = useCallback(() => {
    updateBlockData(id, { autoRun: false });
  }, [id, updateBlockData]);

  return (
    <>
      <BaseBlockNode
        id={id}
        selected={selected}
        status={blockData.status}
        error={blockData.error}
        accentColor="var(--accent-primary)"
        blockType="image"
        hasContent={hasContent}
        toolbarButtons={
          <>
            <BlockToolbarButton
              onClick={handleVariations}
              disabled={blockData.status === "running" || !promptFromInput}
              title="Variations"
            >
              <LayoutGrid size={16} />
            </BlockToolbarButton>
            <BlockToolbarButton
              onClick={handleDescribe}
              disabled={blockData.status === "running" || !blockData.imageUrl}
              title="Describe"
            >
              <PilcrowRight size={16} />
            </BlockToolbarButton>
            <BlockToolbarButton
              onClick={handleImageToJson}
              disabled={blockData.status === "running" || !blockData.imageUrl}
              title="Image to JSON"
            >
              <Braces size={16} />
            </BlockToolbarButton>
          </>
        }
        onPlay={handleGenerate}
        runButtonDisabled={!blockData.prompt?.trim()}
        runButtonTitle="Generate image"
        prompt={blockData.prompt}
        onPromptChange={handlePromptChange}
        promptPlaceholder="Let your prompt imagination run wild..."
        promptReadonly={promptFromInput}
        models={models.imageModels}
        selectedModel={blockData.model || models.defaultImageModel}
        onModelChange={handleModelChange}
        autoRun={blockData.autoRun}
        onAutoRunComplete={handleAutoRunComplete}
      >
        {/* Image content */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className="h-full"
        >
          {blockData.imageUrl ? (
            <div className="relative group">
              <img
                src={blockData.imageUrl}
                alt={blockData.title || "Block image"}
                className="w-full cursor-pointer"
              />
            </div>
          ) : (
            <div className="p-3 h-full">
              {blockData.status !== "running" && (
                <div
                  className="flex flex-col h-full items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors"
                  style={{
                    borderColor: isDragOver
                      ? "var(--accent-secondary)"
                      : "var(--border-default)",
                    background: isDragOver
                      ? "rgba(255, 255, 255, 0.1)"
                      : "var(--bg-elevated)",
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload
                    size={24}
                    style={{
                      color: isDragOver
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                    }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </BaseBlockNode>
    </>
  );
}

export const ImageBlockNode = memo(ImageBlockNodeComponent);
