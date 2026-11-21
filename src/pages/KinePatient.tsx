import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { createProgram, getSessionStats, listPrograms, type Program, type SessionStats } from '../lib/programs';
import ProgramList from '../components/ProgramList';
import NewProgramForm from '../components/NewProgramForm';

/** Kine's view of one patient: programs + recent activity. */
export default function KinePatient() {
  const { patientId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [patient, setPatient] = useState<{ full_name: string | null; email: string | null } | null>(null);
  const [programs, setPrograms] = useState<(Program & { item_count: number })[] | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', patientId)
      .single()
      .then(({ data, error }) => (error ? setError(error.message) : setPatient(data)));
    listPrograms(patientId).then(setPrograms).catch((e) => setError(e.message));
    getSessionStats(patientId).then(setStats).catch(() => undefined);
  }, [patientId]);

  if (!profile) return null;

  const newProgram = async (name: string) => {
    try {
      const p = await createProgram({ patient_id: patientId, kine_id: profile.id, name });
      navigate(`/programs/${p.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const fmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const programName = (id: string) => programs?.find((p) => p.id === id)?.name ?? '';

  return (
    <div className="space-y-5">
      <Link to="/kine" className="text-sm text-brand-700 hover:underline">
        ← {t('kine.patients')}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{patient?.full_name ?? patient?.email ?? '…'}</h1>
        {patient?.full_name && patient.email && <p className="text-sm text-slate-500">{patient.email}</p>}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('program.programs')}</h2>
        {programs === null ? (
          <p className="text-slate-500">{t('app.loading')}</p>
        ) : programs.length === 0 ? (
          <p className="card text-slate-500">{t('kine.noPrograms')}</p>
        ) : (
          <ProgramList programs={programs} canStart={false} canEdit={(p) => p.kine_id === profile.id} />
        )}
        <NewProgramForm label={t('program.new')} onCreate={newProgram} />
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{t('kine.activity')}</h2>
        {stats && (
          <p className="text-sm text-slate-600">
            {t('kine.streakInfo', { streak: stats.streakDays, today: stats.todayCount })}
          </p>
        )}
        {!stats?.last.length ? (
          <p className="text-slate-500">{t('kine.noActivity')}</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {stats.last.map((s) => (
              <li key={s.started_at} className="flex justify-between gap-3 py-2">
                <span>{fmt.format(new Date(s.started_at))}</span>
                <span className="truncate text-slate-500">{programName(s.program_id)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
