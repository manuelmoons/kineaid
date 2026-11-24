import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../lib/auth';
import { supabase, type Practice } from '../lib/supabase';
import Modal from '../components/Modal';

interface PatientRow {
  patient_id: string;
  full_name: string | null;
  email: string | null;
  linked_at: string;
  last_session_at: string | null;
  sessions_7d: number;
  active_programs: number;
}

type Filter = 'all' | 'active' | 'attention' | 'noProgram';
type Sort = 'activity' | 'name' | 'newest';
const PAGE = 30;
const DAY = 86_400_000;

const daysAgo = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null);
/** Has a program but did not exercise in the last 7 days (or never). */
const needsAttention = (p: PatientRow) => p.active_programs > 0 && (daysAgo(p.last_session_at) ?? Infinity) >= 7;
const displayName = (p: PatientRow) => p.full_name || p.email || '—';

/** Patients of the practice (all info in one database call). Falls back to the basic list before migration 0013. */
async function loadPatients(kineId: string): Promise<PatientRow[]> {
  const { data, error } = await supabase.rpc('kine_patient_overview');
  if (!error) return (data ?? []) as PatientRow[];
  const { data: links } = await supabase.from('patient_links').select('patient_id, created_at').eq('kine_id', kineId).eq('status', 'active');
  const ids = (links ?? []).map((l) => l.patient_id as string);
  const { data: profiles } = ids.length ? await supabase.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  return (links ?? []).map((l) => ({
    patient_id: l.patient_id,
    full_name: byId.get(l.patient_id)?.full_name ?? null,
    email: byId.get(l.patient_id)?.email ?? null,
    linked_at: l.created_at,
    last_session_at: null,
    sessions_7d: 0,
    active_programs: 0,
  }));
}

export default function KineHome() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [practice, setPractice] = useState<Practice | null>(null);
  const [patients, setPatients] = useState<PatientRow[] | null>(null);
  const [inviting, setInviting] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('activity');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    if (!profile || profile.role !== 'kine') return;
    supabase.from('practices').select('*').eq('kine_id', profile.id).single().then(({ data }) => setPractice(data as Practice));
    const refresh = () => loadPatients(profile.id).then(setPatients).catch(() => setPatients((p) => p ?? []));
    refresh();
    // Refresh when the kine comes back to the tab/app (e.g. after a patient scanned the QR code)
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(timer);
    };
  }, [profile]);

  useEffect(() => setShown(PAGE), [q, filter, sort]);

  const counts = useMemo(() => {
    const list = patients ?? [];
    return {
      all: list.length,
      active: list.filter((p) => p.sessions_7d > 0).length,
      attention: list.filter(needsAttention).length,
      noProgram: list.filter((p) => p.active_programs === 0).length,
    };
  }, [patients]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (patients ?? []).filter((p) => {
      if (needle && !`${p.full_name ?? ''} ${p.email ?? ''}`.toLowerCase().includes(needle)) return false;
      if (filter === 'active') return p.sessions_7d > 0;
      if (filter === 'attention') return needsAttention(p);
      if (filter === 'noProgram') return p.active_programs === 0;
      return true;
    });
    const collator = new Intl.Collator(i18n.resolvedLanguage);
    return list.sort((a, b) => {
      if (sort === 'name') return collator.compare(displayName(a), displayName(b));
      if (sort === 'newest') return b.linked_at.localeCompare(a.linked_at);
      // Last activity: most recent first, never-exercised last
      return (b.last_session_at ?? '').localeCompare(a.last_session_at ?? '') || collator.compare(displayName(a), displayName(b));
    });
  }, [patients, q, filter, sort, i18n.resolvedLanguage]);

  if (profile && profile.role !== 'kine') return <Navigate to="/patient" replace />;
  if (!practice || patients === null) return <p className="p-8 text-center text-slate-500">{t('app.loading')}</p>;

  const activity = (p: PatientRow) => {
    const d = daysAgo(p.last_session_at);
    if (d === null) return t('kine.neverExercised');
    if (d === 0) return t('kine.exercisedToday');
    if (d === 1) return t('kine.exercisedYesterday');
    return t('kine.exercisedDaysAgo', { count: d });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{t('kine.dashboard')}</p>
          <h1 className="text-2xl font-bold">{practice.name}</h1>
        </div>
        {patients.length > 0 && (
          <button className="btn-primary py-2" onClick={() => setInviting(true)}>
            + {t('kine.invitePatient')}
          </button>
        )}
      </div>

      {patients.length === 0 ? (
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold">{t('kine.invite')}</h2>
          <InvitePanel practice={practice} onChange={setPractice} />
          <p className="text-slate-500">{t('kine.noPatients')}</p>
        </section>
      ) : (
        <>
          {/* Key figures; each one also filters the list */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['all', 'active', 'attention', 'noProgram'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`card p-3 text-left transition ${filter === f ? 'ring-2 ring-brand-600' : 'hover:bg-slate-50'}`}
              >
                <p className={`text-2xl font-bold ${f === 'attention' && counts.attention > 0 ? 'text-amber-600' : 'text-brand-700'}`}>{counts[f]}</p>
                <p className="text-sm text-slate-600">{t(`kine.filter.${f}`)}</p>
              </button>
            ))}
          </div>

          <section className="card space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                className="input min-w-0 flex-1 py-2"
                placeholder={t('kine.searchPatients')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={t('kine.searchPatients')}
              />
              <select className="input w-auto py-2" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t('kine.sortBy')}>
                <option value="activity">{t('kine.sort.activity')}</option>
                <option value="name">{t('kine.sort.name')}</option>
                <option value="newest">{t('kine.sort.newest')}</option>
              </select>
            </div>
            <p className="text-sm text-slate-500">{t('kine.patientCount', { count: visible.length })}</p>

            {visible.length === 0 ? (
              <p className="py-4 text-center text-slate-500">{t('kine.noMatches')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visible.slice(0, shown).map((p) => {
                  const attention = needsAttention(p);
                  return (
                    <li key={p.patient_id}>
                      <Link to={`/kine/patients/${p.patient_id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
                        <span
                          aria-hidden
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            attention ? 'bg-amber-100 text-amber-800' : 'bg-brand-50 text-brand-800'
                          }`}
                        >
                          {displayName(p).slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{displayName(p)}</span>
                          {p.full_name && p.email && <span className="block truncate text-xs text-slate-500">{p.email}</span>}
                        </span>
                        <span className="shrink-0 text-right text-sm">
                          <span className={`block ${attention ? 'font-medium text-amber-700' : 'text-slate-600'}`}>{activity(p)}</span>
                          <span className="block text-xs text-slate-500">
                            {p.active_programs === 0 ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{t('kine.noProgramBadge')}</span>
                            ) : (
                              t('kine.sessionsThisWeek', { count: p.sessions_7d })
                            )}
                          </span>
                        </span>
                        <span aria-hidden className="text-slate-400">
                          ›
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {visible.length > shown && (
              <button className="btn-secondary w-full" onClick={() => setShown((n) => n + PAGE)}>
                {t('kine.showMore', { count: Math.min(PAGE, visible.length - shown) })}
              </button>
            )}
          </section>
        </>
      )}

      {inviting && (
        <Modal title={t('kine.invite')} onClose={() => setInviting(false)}>
          <InvitePanel practice={practice} onChange={setPractice} />
        </Modal>
      )}
    </div>
  );
}

/** QR code, code and link a patient uses to join the practice. */
function InvitePanel({ practice, onChange }: { practice: Practice; onChange: (p: Practice) => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/join/${practice.invite_code}`;

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const regenerate = async () => {
    const { data } = await supabase.rpc('regenerate_invite_code');
    if (typeof data === 'string') onChange({ ...practice, invite_code: data });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{t('kine.inviteHelp')}</p>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <QRCodeSVG value={inviteUrl} size={180} />
        </div>
        <div className="w-full min-w-0 space-y-3">
          <p className="font-mono text-3xl font-bold tracking-widest text-brand-800">{practice.invite_code}</p>
          <p className="break-all text-sm text-slate-600">{inviteUrl}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={copy}>
              {copied ? t('kine.copied') : t('kine.copyLink')}
            </button>
            <button className="btn-secondary" onClick={regenerate}>
              {t('kine.newCode')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
