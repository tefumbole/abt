import React, { useEffect, useRef, useState } from 'react';
import { ClipboardPaste, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { imageFileFromClipboard } from '@/lib/erpImages';

/**
 * Image cell: click shows Paste, double-click opens the file picker.
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
  const rootRef = useRef(null);
  const clickTimer = useRef(null);
  const [menu, setMenu] = useState(null);
  const [hint, setHint] = useState('');

  const box = size === 'sm'
    ? 'h-10 w-10'
    : size === 'lg'
      ? 'h-28 w-full min-w-[7rem]'
      : 'h-14 w-14';

  const take = (file) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) return;
    setMenu(null);
    setHint('');
    onFile?.(file);
  };

  const openAttach = () => {
    if (uploading) return;
    setMenu(null);
    inputRef.current?.click();
  };

  const openPasteMenu = () => {
    if (uploading) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(rect.left, window.innerWidth - 220);
    setHint('');
    setMenu({ top: rect.bottom + 6, left: Math.max(8, left) });
  };

  const pasteFromClipboard = async () => {
    onActivate?.();
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((entry) => entry.startsWith('image/'));
          if (!type) continue;
          const blob = await item.getType(type);
          const ext = type.split('/')[1] || 'png';
          take(new File([blob], `pasted.${ext}`, { type }));
          return;
        }
      }
      setHint('Copy an image, then press ⌘V or Ctrl+V');
    } catch {
      setHint('Copy an image, then press ⌘V or Ctrl+V');
    }
  };

  useEffect(() => () => clearTimeout(clickTimer.current), []);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (event.target?.closest?.('[data-paste-image-menu]')) return;
      setMenu(null);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  return (
    <>
      <button
        ref={rootRef}
        type="button"
        title="Click to paste · Double-click to attach a file"
        className={cn(
          box,
          'relative shrink-0 rounded-lg border bg-slate-100 flex items-center justify-center overflow-hidden',
          'hover:border-[#003D82] focus:outline-none focus:ring-2 focus:ring-[#003D82]/30',
          menu && 'ring-2 ring-[#003D82]/30 border-[#003D82]',
          className
        )}
        onClick={() => {
          onActivate?.();
          clearTimeout(clickTimer.current);
          clickTimer.current = setTimeout(openPasteMenu, 220);
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          clearTimeout(clickTimer.current);
          openAttach();
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
          <img src={src} alt={alt} className="max-h-full max-w-full object-contain pointer-events-none" />
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
      {menu ? (
        <div
          data-paste-image-menu
          className="fixed z-[80] w-52 rounded-lg border bg-white p-2 shadow-lg"
          style={{ top: menu.top, left: menu.left }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-50"
            onClick={pasteFromClipboard}
          >
            <ClipboardPaste className="h-4 w-4 text-[#003D82]" />
            Paste image
          </button>
          <p className="px-2 pb-1 text-[11px] text-slate-500">
            {hint || 'Or press ⌘V / Ctrl+V. Double-click the picture to attach a file.'}
          </p>
        </div>
      ) : null}
    </>
  );
}
