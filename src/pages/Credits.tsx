import { useTranslation } from 'react-i18next';

const SOURCES = [
  {
    key: 'kineaid',
    name: 'KineAid',
    url: null,
    license: 'KineAid',
  },
  {
    key: 'fedb',
    name: 'free-exercise-db',
    url: 'https://github.com/yuhonas/free-exercise-db',
    license: 'Unlicense (public domain)',
    licenseUrl: 'https://unlicense.org/',
  },
  {
    key: 'wger',
    name: 'wger Workout Manager',
    url: 'https://wger.de',
    license: 'CC-BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    key: 'custom',
    name: '',
    url: null,
    license: null,
  },
] as const;

export default function Credits() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('credits.title')}</h1>
      <p className="text-slate-600">{t('credits.intro')}</p>
      <ul className="space-y-3">
        {SOURCES.map((s) => (
          <li key={s.key} className="card space-y-1">
            {s.name && (
              <h2 className="font-semibold">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                    {s.name}
                  </a>
                ) : (
                  s.name
                )}
              </h2>
            )}
            <p className="text-sm text-slate-600">{t(`credits.${s.key}`)}</p>
            {s.license && 'licenseUrl' in s && (
              <p className="text-sm">
                {t('credits.license')}:{' '}
                <a href={s.licenseUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                  {s.license}
                </a>
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{t('credits.disclaimer')}</p>
    </div>
  );
}
