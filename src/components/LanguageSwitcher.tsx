import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const current = i18n.resolvedLanguage;

  const change = async (lng: (typeof LANGUAGES)[number]) => {
    await i18n.changeLanguage(lng);
    if (profile && profile.locale !== lng) {
      await supabase.from('profiles').update({ locale: lng }).eq('id', profile.id);
    }
  };

  return (
    <div role="group" aria-label={t('app.language')} className="flex overflow-hidden rounded-lg border border-slate-300 text-xs">
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          onClick={() => change(lng)}
          aria-pressed={current === lng}
          className={`px-2 py-1 uppercase ${current === lng ? 'bg-brand-700 text-white' : 'bg-white text-slate-600'}`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}
