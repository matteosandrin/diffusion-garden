import { memo, useCallback, useState, useRef } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  FileText,
  Upload,
  X,
} from 'lucide-react';
import type { ImageBlockData } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { toolsApi, imageApi } from '../../api/client';
import { BaseBlockNode } from './BaseBlockNode';

function ImageBlockNodeComponent({ id, data, selected }: NodeProps) {
  const blockData = data as unknown as ImageBlockData;
  const { updateBlockData, updateBlockStatus, addTextBlock } = useCanvasStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        });
        updateBlockStatus(id, 'success');
      } catch (error) {
        updateBlockStatus(id, 'error', error instanceof Error ? error.message : 'Upload failed');
      }
    },
    [id, updateBlockData, updateBlockStatus]
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

  return (
    <>
      <BaseBlockNode
        id={id}
        selected={selected}
        status={blockData.status}
        error={blockData.error}
        accentColor="var(--accent-secondary)"
        glowShadow="0 0 30px rgba(236, 72, 153, 0.3)"
        toolbarButtons={
          blockData.imageUrl ? (
            <button
              onClick={handleDescribe}
              disabled={blockData.status === 'running'}
              className="p-1.5 rounded transition-all disabled:opacity-50 hover:bg-opacity-80"
              style={{
                background: blockData.status === 'running' ? 'transparent' : 'var(--accent-primary)',
                color: 'white',
              }}
              title="Describe this image"
            >
              <FileText size={16} />
            </button>
          ) : null
        }
        footer={
          blockData.imageUrl && blockData.prompt ? (
            <div
              className="px-3 py-2 border-t"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <p
                className="text-xs truncate"
                style={{ color: 'var(--text-muted)' }}
                title={blockData.prompt}
              >
                {blockData.prompt}
              </p>
            </div>
          ) : null
        }
      >
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
                className="w-full rounded-lg cursor-pointer"
                onClick={() => setIsModalOpen(true)}
              />
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
      </BaseBlockNode>

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

