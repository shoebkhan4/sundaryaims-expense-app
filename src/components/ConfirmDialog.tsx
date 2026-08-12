import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  /** Extra line shown in a highlighted box, e.g. the item being deleted. */
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling and a bin icon for destructive actions. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the safe option and let Escape back out.
  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              destructive ? 'bg-rose-500/15 text-rose-400' : 'bg-cyan-500/15 text-cyan-400'
            }`}
          >
            {destructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>

          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="text-sm font-bold text-slate-100">
              {title}
            </h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">{message}</p>

            {detail && (
              <div className="mt-3 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2">
                <p className="text-xs font-semibold text-slate-200 break-words">{detail}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="p-1.5 -mt-1 -mr-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 flex items-center gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-extrabold shadow-lg transition ${
              destructive
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
                : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/25'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
