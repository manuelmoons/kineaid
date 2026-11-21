import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const ONBOARDED_KEY = 'kineaid.onboarded';
export const hasOnboarded = () => {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
};
const markOnboarded = () => {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    /* ignore */
  }
};

export default function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [code, setCode] = useState('');
  const [practiceName, setPracticeName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const joinPractice = (e: FormEvent) => {
    e.preventDefault();
    markOnboarded();
    navigate(`/join/${encodeURIComponent(code.trim())}`);
  };

  const createPractice = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('become_kine', { p_practice_name: practiceName.trim() });
    setBusy(false);
    if (error) return setError(error.message);
    markOnboarded();
    await refreshProfile();
    navigate('/kine', { replace: true });
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t('onboarding.title')}</h1>
        <p className="text-slate-600">{t('onboarding.question')}</p>
      </div>

      <form onSubmit={joinPractice} className="card space-y-3">
        <h2 className="text-lg font-semibold">{t('onboarding.patient')}</h2>
        <p className="text-sm text-slate-600">{t('onboarding.patientHelp')}</p>
        <input className="input uppercase tracking-widest" required placeholder={t('onboarding.inviteCode')} value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn-primary w-full">{t('onboarding.join')}</button>
        <button
          type="button"
          className="w-full text-sm text-slate-500 hover:underline"
          onClick={() => {
            markOnboarded();
            navigate('/patient', { replace: true });
          }}
        >
          {t('onboarding.skip')}
        </button>
      </form>

      <form onSubmit={createPractice} className="card space-y-3">
        <h2 className="text-lg font-semibold">{t('onboarding.kine')}</h2>
        <input className="input" required placeholder={t('onboarding.practiceName')} value={practiceName} onChange={(e) => setPracticeName(e.target.value)} />
        <button className="btn-secondary w-full" disabled={busy}>
          {t('onboarding.createPractice')}
        </button>
      </form>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
