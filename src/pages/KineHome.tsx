import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../lib/auth';
import { supabase, type Practice } from '../lib/supabase';

interface PatientRow {
  patient_id: string;
  created_at: string;
  name: string | null;
  email: string | null;
}

export default function KineHome() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [practice, setPractice] = useState<Practice | null>(null);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile || profile.role !== 'kine') return;
    supabase.from('practices').select('*').eq('kine_id', profile.id).single().then(({ data }) => setPractice(data as Practice));

    const loadPatients = async () => {
      const { data: links } = await supabase
        .from('patient_links')
        .select('patient_id, created_at')
        .eq('kine_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      const ids = (links ?? []).map((l) => l.patient_id as string);
      const { data: profiles } = ids.length
        ? await supabase.from('profiles').select('id, full_name, email').in('id', ids)
        : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      setPatients(
        (links ?? []).map((l) => ({
          patient_id: l.patient_id,
          created_at: l.created_at,
          name: byId.get(l.patient_id)?.full_name ?? null,
          email: byId.get(l.patient_id)?.email ?? null,
        })),
      );
    };

    loadPatients();
    // Refresh when the kine comes back to the tab/app (e.g. after a patient scanned the QR code)
    const onVisible = () => document.visibilityState === 'visible' && loadPatients();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const timer = window.setInterval(loadPatients, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(timer);
    };
  }, [profile]);

  if (profile && profile.role !== 'kine') return <Navigate to="/patient" replace />;
  if (!practice) return <p className="p-8 text-center text-slate-500">{t('app.loading')}</p>;

  const inviteUrl = `${window.location.origin}/join/${practice.invite_code}`;

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = async () => {
    const { data } = await supabase.rpc('regenerate_invite_code');
    if (typeof data === 'string') setPractice({ ...practice, invite_code: data });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{t('kine.dashboard')}</p>
        <h1 className="text-2xl font-bold">{practice.name}</h1>
      </div>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">{t('kine.invite')}</h2>
        <p className="text-sm text-slate-600">{t('kine.inviteHelp')}</p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <QRCodeSVG value={inviteUrl} size={180} />
          </div>
          <div className="w-full min-w-0 space-y-3">
            <p className="text-3xl font-mono font-bold tracking-widest text-brand-800">{practice.invite_code}</p>
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
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{t('kine.patients')}</h2>
        {patients.length === 0 ? (
          <p className="text-slate-500">{t('kine.noPatients')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {patients.map((p) => (
              <li key={p.patient_id}>
                <Link to={`/kine/patients/${p.patient_id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name ?? p.email ?? '—'}</span>
                  {p.name && p.email && <span className="block truncate text-sm text-slate-500">{p.email}</span>}
                </span>
                <span className="shrink-0 text-sm text-slate-500">{new Date(p.created_at).toLocaleDateString()} ›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
