import { memo, useCallback, useState, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Image,
  FileText,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  Maximize2,
  X,
} from 'lucide-react';
import type { ImageBlockData } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { toolsApi, imageApi } from '../../api/client';

function ImageBlockNodeComponent({ id, data, selected }: NodeProps) {
  const blockData = data as unknown as ImageBlockData;
  const { updateBlockData, updateBlockStatus, addTextBlock } = useCanvasStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateBlockData(id, { title: e.target.value });
    },
    [id, updateBlockData]
  );

  const handleDescribe = useCallback(async () => {
    if (!blockData.imageUrl) return;

    updateBlockStatus(id, 'running');

    try {
      // Fetch image and convert to base64
      let imageBase64 = blockData.imageUrl;
      
      if (!imageBase64.startsWith('data:')) {
        const response = await fetch(blockData.imageUrl);
        const blob = await response.blob();
        imageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const result = await toolsApi.describe(imageBase64);

      // Create new text block with description
      const store = useCanvasStore.getState();
      const currentNode = store.nodes.find((n) => n.id === id);
      if (!currentNode) return;

      const newBlockId = addTextBlock(
        {
          x: currentNode.position.x + 350,
          y: currentNode.position.y,
        },
        {
          content: result.description,
          title: blockData.title ? `${blockData.title} (description)` : 'Image Description',
          generatedBy: 'describe',
          sourceBlockId: id,
        }
      );

      // Add edge
      store.onConnect({
        source: id,
        target: newBlockId,
        sourceHandle: null,
        targetHandle: null,
      });

      updateBlockStatus(id, 'success');
    } catch (error) {
      updateBlockStatus(id, 'error', error instanceof Error ? error.message : 'Failed to describe');
    }
  }, [id, blockData, updateBlockStatus, addTextBlock]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        updateBlockStatus(id, 'error', 'Please upload an image file');
        return;
      }

      updateBlockStatus(id, 'running');

      try {
        const result = await imageApi.upload(file);
        updateBlockData(id, {
          imageUrl: result.imageUrl,
          imageId: result.imageId,
          source: 'upload',
          title: blockData.title || file.name.split('.')[0],
        });
        updateBlockStatus(id, 'success');
      } catch (error) {
        updateBlockStatus(id, 'error', error instanceof Error ? error.message : 'Upload failed');
      }
    },
    [id, blockData.title, updateBlockData, updateBlockStatus]
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
    [handleFileUpload]
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
    [handleFileUpload]
  );

  const statusIcon = {
    idle: null,
    running: <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent-secondary)' }} />,
    success: <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />,
    error: <AlertCircle size={14} style={{ color: 'var(--accent-error)' }} />,
  }[blockData.status];

  return (
    <>
      <div
        className="relative min-w-[280px] max-w-[400px] rounded-xl transition-all duration-200"
        style={{
          background: 'var(--bg-card)',
          border: `2px solid ${selected ? 'var(--accent-secondary)' : 'var(--border-subtle)'}`,
          boxShadow: selected ? '0 0 30px rgba(236, 72, 153, 0.3)' : 'var(--shadow-card)',
        }}
      >
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3"
          style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--border-default)',
          }}
        />

        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <Image size={16} style={{ color: 'var(--accent-secondary)' }} />
          <input
            type="text"
            value={blockData.title}
            onChange={handleTitleChange}
            placeholder="Untitled Image"
            className="flex-1 bg-transparent text-sm font-medium outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          {blockData.source === 'generated' && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                background: 'rgba(236, 72, 153, 0.2)',
                color: 'var(--accent-secondary)',
              }}
            >
              AI
            </span>
          )}
          {statusIcon}
        </div>

        {/* Image content */}
        <div
          className="p-3"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {blockData.imageUrl ? (
            <div className="relative group">
              <img
                src={blockData.imageUrl}
                alt={blockData.title || 'Block image'}
                className="w-full h-auto rounded-lg max-h-[200px] object-cover cursor-pointer"
                onClick={() => setIsModalOpen(true)}
              />
              <button
                onClick={() => setIsModalOpen(true)}
                className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
                }}
              >
                <Maximize2 size={14} />
              </button>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors"
              style={{
                borderColor: isDragOver ? 'var(--accent-secondary)' : 'var(--border-default)',
                background: isDragOver ? 'rgba(236, 72, 153, 0.1)' : 'var(--bg-elevated)',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload
                size={24}
                style={{ color: isDragOver ? 'var(--accent-secondary)' : 'var(--text-muted)' }}
              />
              <div className="text-center">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Drop an image or click to upload
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  PNG, JPG, GIF, WebP
                </p>
              </div>
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

        {/* Footer with tools */}
        {blockData.imageUrl && (
          <div
            className="flex items-center justify-between px-3 py-2 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {blockData.prompt && (
              <p
                className="text-xs truncate max-w-[150px]"
                style={{ color: 'var(--text-muted)' }}
                title={blockData.prompt}
              >
                {blockData.prompt}
              </p>
            )}
            {!blockData.prompt && <div />}

            <button
              onClick={handleDescribe}
              disabled={blockData.status === 'running'}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all disabled:opacity-50"
              style={{
                background: 'var(--accent-primary)',
                color: 'white',
              }}
              title="Describe this image"
            >
              <FileText size={12} />
              Describe
            </button>
          </div>
        )}

        {/* Error message */}
        {blockData.status === 'error' && blockData.error && (
          <div
            className="px-3 py-2 text-xs border-t"
            style={{
              borderColor: 'var(--accent-error)',
              color: 'var(--accent-error)',
              background: 'rgba(239, 68, 68, 0.1)',
            }}
          >
            {blockData.error}
          </div>
        )}

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3"
          style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--border-default)',
          }}
        />
      </div>

      {/* Image Modal */}
      {isModalOpen && blockData.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setIsModalOpen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
            }}
            onClick={() => setIsModalOpen(false)}
          >
            <X size={24} />
          </button>
          <img
            src={blockData.imageUrl}
            alt={blockData.title || 'Full size image'}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

export const ImageBlockNode = memo(ImageBlockNodeComponent);

