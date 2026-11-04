import React, { useRef } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { imageFileFromClipboard } from '@/lib/erpImages';

/**
 * Compact image cell: click to pick a file, paste while focused to upload.
 */
export default function PasteableImage({
  src,
  alt = '',
  uploading = false,
  onFile,
  onActivate,
  className,
  size = 'md',
}) {
  const inputRef = useRef(null);
  const box = size === 'sm' ? 'h-10 w-10' : 'h-14 w-14';

  const take = (file) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) return;
    onFile?.(file);
  };

  return (
    <button
      type="button"
      title="Click to upload or paste an image"
      className={cn(
        box,
        'relative shrink-0 rounded-lg border bg-slate-100 flex items-center justify-center overflow-hidden',
        'hover:border-[#003D82] focus:outline-none focus:ring-2 focus:ring-[#003D82]/30',
        className
      )}
      onClick={() => {
        onActivate?.();
        if (!uploading) inputRef.current?.click();
      }}
      onFocus={() => onActivate?.()}
      onPaste={(event) => {
        const file = imageFileFromClipboard(event);
        if (file) {
          event.preventDefault();
          take(file);
        }
      }}
    >
      {uploading ? (
        <Loader2 className="h-4 w-4 animate-spin text-[#003D82]" />
      ) : src ? (
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      ) : (
        <ImageIcon className="h-5 w-5 text-slate-300" />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </button>
  );
}
