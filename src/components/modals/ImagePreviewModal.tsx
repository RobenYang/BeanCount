
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import NextImage from 'next/image';
import type { Root as DialogRootProps } from '@radix-ui/react-dialog';

interface ImagePreviewModalProps {
  imageUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
}

export function ImagePreviewModal({ imageUrl, isOpen, onClose, productName }: ImagePreviewModalProps) {
  if (!imageUrl) return null;

  const handleOpenChange: DialogRootProps['onOpenChange'] = (open) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-3xl p-0" 
        onPointerDownOutside={(e) => { e.preventDefault(); onClose();}} // Prevent closing on click outside image itself, default behavior can close
        onEscapeKeyDown={onClose}
      >
        <DialogHeader className="p-4 pb-2 border-b">
          {productName && <DialogTitle>{productName} - 图片预览</DialogTitle>}
        </DialogHeader>
        <div className="p-4 flex justify-center items-center bg-muted/20">
          <NextImage
            src={imageUrl}
            alt={productName || '产品图片'}
            width={1200} // Provide a large base width for aspect ratio calculation
            height={1200} // Provide a large base height
            style={{
              width: '100%', 
              height: 'auto', 
              maxHeight: '80vh', 
              objectFit: 'contain',
            }}
            className="rounded-md shadow-lg"
            priority // Preload if it's an important image, consider removing if many modals can open
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
