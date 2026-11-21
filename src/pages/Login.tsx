import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pendingInvite, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function Login() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviter, setInviter] = useState<string | null>(null);

  const invite = pendingInvite.get();
  useEffect(() => {
    if (!invite) return;
    supabase.rpc('practice_by_code', { p_code: invite }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : null;
      if (row?.name) setInviter(row.name);
    });
  }, [invite]);

  if (session) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={invite ? `/join/${invite}` : from ?? '/'} replace />;
  }

  const redirectTo = window.location.origin + (invite ? `/join/${invite}` : '/');

  const run = async (fn: () => Promise<{ error: Error | null }>, successMsg?: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(error.message);
    else if (successMsg) setMessage(successMsg);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'signIn') {
      run(() => supabase.auth.signInWithPassword({ email, password }));
    } else {
      run(
        () => supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } }),
        t('login.signUpSent'),
      );
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t('login.title')}</h1>
        <p className="text-slate-600">{t('app.tagline')}</p>
      </div>

      {inviter && <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{t('login.invitedBy', { name: inviter })}</p>}

      <button
        className="btn-secondary w-full"
        disabled={busy}
        onClick={() => run(() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } }))}
      >
        <GoogleIcon /> {t('login.google')}
      </button>

      <div className="flex items-center gap-3 text-sm text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> {t('login.or')} <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input className="input" type="email" required autoComplete="email" placeholder={t('login.email')} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="input"
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          placeholder={t('login.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn-primary w-full" disabled={busy}>
          {mode === 'signIn' ? t('login.signIn') : t('login.signUp')}
        </button>
      </form>

      <button
        className="w-full text-sm text-brand-700 hover:underline disabled:opacity-50"
        disabled={busy || !email}
        onClick={() => run(() => supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } }), t('login.magicLinkSent'))}
      >
        {t('login.magicLink')}
      </button>

      <p className="text-center text-sm text-slate-600">
        {mode === 'signIn' ? t('login.noAccount') : t('login.haveAccount')}{' '}
        <button className="font-semibold text-brand-700 hover:underline" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          {mode === 'signIn' ? t('login.signUp') : t('login.signIn')}
        </button>
      </p>

      {message && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
