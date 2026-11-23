import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * In-app yes/no question. Used instead of window.confirm(), which some embedded browsers
 * and installed web apps block (it then silently returns false).
 */
export default function ConfirmDialog({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = false,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-label={message} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-slate-800">{message}</p>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onCancel} autoFocus>
            {t('program.cancel')}
          </button>
          <button type="button" className={`btn flex-1 text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-700 hover:bg-brand-800'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
