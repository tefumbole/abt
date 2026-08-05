import React, { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, List, ListOrdered, RemoveFormatting, Underline,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TOOLS = [
  { command: 'bold', icon: Bold, title: 'Bold' },
  { command: 'italic', icon: Italic, title: 'Italic' },
  { command: 'underline', icon: Underline, title: 'Underline' },
  { command: 'insertUnorderedList', icon: List, title: 'Bullet list' },
  { command: 'insertOrderedList', icon: ListOrdered, title: 'Numbered list' },
  { command: 'removeFormat', icon: RemoveFormatting, title: 'Clear formatting' },
];

function hasText(html) {
  if (!html) return false;
  return String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;
}

/**
 * Minimal contentEditable editor emitting HTML — avoids pulling in a rich-text dependency.
 * `resetKey` re-seeds the editor from `value` (use the record id so the caret never jumps
 * while the user types).
 */
export default function RichTextField({
  value = '',
  onChange,
  placeholder = 'Type here…',
  resetKey = 'new',
  disabled = false,
  minHeight = 180,
}) {
  const ref = useRef(null);
  const [empty, setEmpty] = useState(!hasText(value));

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = value || '';
    setEmpty(!hasText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const emit = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    const clean = html === '<br>' || html === '<div><br></div>' ? '' : html;
    setEmpty(!hasText(clean));
    onChange?.(clean);
  };

  const run = (command) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(command, false, null);
    emit();
  };

  const pastePlainText = (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
    emit();
  };

  return (
    <div className={cn('rounded-md border bg-white', disabled && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-1 border-b bg-slate-50 px-2 py-1.5">
        {TOOLS.map(({ command, icon: Icon, title }) => (
          <button
            key={command}
            type="button"
            title={title}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(command)}
            className="rounded p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div className="relative">
        {empty && (
          <span className="pointer-events-none absolute left-3 top-3 text-sm text-slate-400">
            {placeholder}
          </span>
        )}
        <div
          ref={ref}
          role="textbox"
          tabIndex={0}
          aria-multiline="true"
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onPaste={pastePlainText}
          style={{ minHeight }}
          className="px-3 py-2 text-sm leading-relaxed outline-none [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
        />
      </div>
    </div>
  );
}
