import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getSessionStats, listPrograms, type Program, type SessionStats } from '../lib/programs';
import NamePrompt from '../components/NamePrompt';
import ProgramList from '../components/ProgramList';

export default function PatientHome() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [kines, setKines] = useState<string[]>([]);
  const [programs, setPrograms] = useState<(Program & { item_count: number })[] | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('patient_links')
      .select('kine_id')
      .eq('patient_id', profile.id)
      .eq('status', 'active')
      .then(async ({ data }) => {
        const ids = (data ?? []).map((r) => r.kine_id as string);
        if (!ids.length) return setKines([]);
        const { data: practices } = await supabase.from('practices').select('name').in('kine_id', ids);
        setKines((practices ?? []).map((p) => p.name as string));
      });
    listPrograms(profile.id).then(setPrograms).catch((e) => setError(e.message));
    getSessionStats(profile.id).then(setStats).catch(() => undefined);
  }, [profile]);

  if (profile?.role === 'kine') return <Navigate to="/kine" replace />;
  if (!profile) return null;

  const active = programs?.filter((p) => p.active) ?? [];
  const inactive = programs?.filter((p) => !p.active) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('patient.today')}</h1>
        {kines.length > 0 && (
          <p className="text-sm text-slate-600">
            {t('patient.myKine')}: <span className="font-semibold">{kines.join(', ')}</span>
          </p>
        )}
      </div>

      <NamePrompt />

      {stats && (stats.todayCount > 0 || stats.streakDays > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-brand-700">{stats.todayCount}</p>
            <p className="text-sm text-slate-600">{t('patient.doneToday')}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-brand-700">{stats.streakDays}</p>
            <p className="text-sm text-slate-600">{t('patient.streak')}</p>
          </div>
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {programs === null ? (
        <p className="text-slate-500">{t('app.loading')}</p>
      ) : active.length === 0 ? (
        <div className="card space-y-2">
          <p>{t('patient.noProgram')}</p>
        </div>
      ) : (
        <ProgramList programs={active} canStart canEdit={() => false} />
      )}

      {inactive.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-slate-600">{t('program.inactivePrograms', { count: inactive.length })}</summary>
          <div className="mt-3">
            <ProgramList programs={inactive} canStart={false} canEdit={() => false} />
          </div>
        </details>
      )}
    </div>
  );
}
