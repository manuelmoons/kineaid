import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

/** Button that turns into an inline "name + create" form. */
export default function NewProgramForm({ label, onCreate }: { label: string; onCreate: (name: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        className="btn-secondary w-full"
        onClick={() => {
          setName(t('program.defaultName'));
          setOpen(true);
        }}
      >
        + {label}
      </button>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onCreate(name.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-3">
      <label className="block">
        <span className="text-sm font-medium">{t('program.newName')}</span>
        <input className="input mt-1" autoFocus required value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} />
      </label>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy || !name.trim()}>
          {t('program.create')}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          {t('program.cancel')}
        </button>
      </div>
    </form>
  );
}
