import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pendingInvite, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

/** /join/:code — opened from the kine's link or QR code. */
export default function Join() {
  const { code = '' } = useParams();
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const [state, setState] = useState<'joining' | 'done' | 'error'>('joining');
  const [practiceName, setPracticeName] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (loading || !session || started.current) return;
    started.current = true;
    supabase.rpc('join_practice', { p_code: code }).then(({ data, error }) => {
      pendingInvite.clear();
      if (error) return setState('error');
      setPracticeName((data as { name: string }).name);
      try {
        localStorage.setItem('kineaid.onboarded', '1');
      } catch {
        /* ignore */
      }
      setState('done');
    });
  }, [code, session, loading]);

  if (loading) return <p className="p-8 text-center text-slate-500">{t('app.loading')}</p>;
  if (!session) {
    pendingInvite.set(code);
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="card mx-auto max-w-md space-y-4 text-center">
      {state === 'joining' && <p>{t('join.joining')}</p>}
      {state === 'done' && (
        <>
          <p className="text-lg font-semibold">{t('join.success', { name: practiceName })}</p>
          <Link to="/patient" className="btn-primary w-full">
            {t('patient.today')}
          </Link>
        </>
      )}
      {state === 'error' && (
        <>
          <p className="text-red-700">{t('join.invalid')}</p>
          <Link to="/welcome" className="btn-secondary w-full">
            {t('onboarding.inviteCode')}
          </Link>
        </>
      )}
    </div>
  );
}
