import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import NamePrompt from '../components/NamePrompt';

export default function PatientHome() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [kines, setKines] = useState<string[]>([]);

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
  }, [profile]);

  if (profile?.role === 'kine') return <Navigate to="/kine" replace />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('patient.today')}</h1>
      <NamePrompt />
      {kines.length > 0 && (
        <p className="text-sm text-slate-600">
          {t('patient.myKine')}: <span className="font-semibold">{kines.join(', ')}</span>
        </p>
      )}
      <div className="card space-y-2">
        <p>{t('patient.noProgram')}</p>
        <p className="text-sm text-slate-500">{t('patient.comingSoon')}</p>
      </div>
    </div>
  );
}
