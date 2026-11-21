import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

/** Asks for the user's name when the profile has none (e.g. after an email sign-up). */
export default function NamePrompt() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile || profile.full_name) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', profile.id);
    setBusy(false);
    if (error) return setError(error.message);
    await refreshProfile();
  };

  return (
    <form onSubmit={save} className="card space-y-3 ring-brand-500">
      <label htmlFor="full-name" className="block font-semibold">
        {t('profile.askName')}
      </label>
      <p className="text-sm text-slate-600">{t('profile.askNameHelp')}</p>
      <div className="flex gap-2">
        <input id="full-name" className="input" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" disabled={busy || !name.trim()}>
          {t('profile.save')}
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
