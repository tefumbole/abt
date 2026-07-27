import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

function firstImageFile(fileListOrItems) {
  if (!fileListOrItems) return null;
  const list = Array.from(fileListOrItems);
  for (const item of list) {
    if (item?.kind === 'file') {
      const file = item.getAsFile?.();
      if (file && file.type.startsWith('image/')) return file;
    } else if (item instanceof File && item.type.startsWith('image/')) {
      return item;
    }
  }
  return null;
}

/**
 * Click / drag-drop / paste image upload zone.
 * Paste works when the zone is focused or hovered (data-image-upload).
 */
export default function ImageUploadZone({
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  disabled = false,
  onFile,
  className,
  title = 'Click, drop, or paste an image',
  hint = 'JPG, PNG, WebP, GIF — you can Ctrl/Cmd+V paste from clipboard',
  children,
}) {
  const inputRef = useRef(null);
  const zoneRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [pasteHint, setPasteHint] = useState(false);

  const deliver = useCallback(
    (file) => {
      if (!file || disabled) return;
      if (!String(file.type || '').startsWith('image/')) return;
      onFile?.(file);
    },
    [disabled, onFile]
  );

  const onDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    deliver(firstImageFile(e.dataTransfer?.files));
  };

  const onPaste = (e) => {
    if (disabled) return;
    const file = firstImageFile(e.clipboardData?.items);
    if (!file) return;
    e.preventDefault();
    deliver(file);
  };

  // Clipboard paste while this zone is focused or hovered (Mulema-style)
  useGlobalImagePaste(deliver, { enabled: !disabled, zoneRef });

  return (
    <div
      ref={zoneRef}
      data-image-upload="true"
      tabIndex={0}
      role="button"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!disabled) inputRef.current?.click();
        }
      }}
      onDragEnter={onDrag}
      onDragLeave={onDrag}
      onDragOver={onDrag}
      onDrop={onDrop}
      onPaste={onPaste}
      onFocus={() => setPasteHint(true)}
      onBlur={() => setPasteHint(false)}
      onMouseEnter={() => setPasteHint(true)}
      onMouseLeave={() => setPasteHint(false)}
      className={cn(
        'relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all outline-none',
        'focus-visible:ring-2 focus-visible:ring-[#003D82]/40 focus-visible:border-[#003D82]',
        dragActive
          ? 'border-[#003D82] bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:border-[#003D82]/50 hover:bg-blue-50/40',
        disabled && 'opacity-60 pointer-events-none',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          deliver(e.target.files?.[0] || null);
          e.target.value = '';
        }}
      />
      {children || (
        <div className="text-center pointer-events-none">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            {dragActive ? (
              <UploadCloud className="w-6 h-6 text-[#003D82]" />
            ) : (
              <ImagePlus className="w-6 h-6 text-[#003D82]" />
            )}
          </div>
          <p className="font-medium text-gray-900 text-sm">{title}</p>
          <p className="text-xs text-gray-500 mt-1">{hint}</p>
          {(pasteHint || dragActive) && (
            <p className="text-xs font-semibold text-[#003D82] mt-2">
              Paste ready — press Ctrl/Cmd+V
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Attach a paste listener that feeds only the focused/hovered image zone.
 * Pass zoneRef so only that zone's onFile runs when multiple zones exist.
 */
export function useGlobalImagePaste(onFile, { enabled = true, zoneRef } = {}) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;

    const handler = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        if (!target.closest?.('[data-image-upload]')) return;
      }
      const activeZone = document.activeElement?.closest?.('[data-image-upload]')
        || document.querySelector('[data-image-upload]:hover');
      if (!activeZone) return;
      if (zoneRef?.current && activeZone !== zoneRef.current) return;

      const file = firstImageFile(e.clipboardData?.items);
      if (!file) return;
      e.preventDefault();
      onFile?.(file, activeZone);
    };

    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [enabled, onFile, zoneRef]);
}

export { firstImageFile };
