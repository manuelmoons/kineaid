import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLang } from '../lib/exercises';
import { PUPPET_EXERCISES } from '../puppet/exercises';
import PuppetViewer from '../puppet/PuppetViewer';
import data from '../../scripts/data/kineaid-exercises.json';

interface RawExercise {
  id: string;
  nl: { name: string; instructions: string[] };
  en: { name: string; instructions: string[] };
}
const exercises = (data as RawExercise[]).filter((e) => PUPPET_EXERCISES[e.id]);
if (import.meta.env.DEV) import('../puppet/debugSheet').then((m) => m.installDebugSheet());

/** Prototype page: all KineAid exercises as 3D puppet animations. */
export default function PuppetDemo() {
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.resolvedLanguage);
  const [id, setId] = useState(() => new URLSearchParams(location.search).get('ex') ?? exercises[0].id);
  const [side, setSide] = useState<'left' | 'right' | null>(null);
  const ex = exercises.find((e) => e.id === id) ?? exercises[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('puppet.demoTitle')}</h1>
        <p className="text-slate-600">{t('puppet.demoIntro')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <select className="input md:hidden" value={ex.id} onChange={(e) => setId(e.target.value)}>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e[lang].name}
            </option>
          ))}
        </select>
        <ul className="card hidden max-h-[70vh] space-y-1 overflow-y-auto p-2 md:block">
          {exercises.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => setId(e.id)}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm ${e.id === ex.id ? 'bg-brand-700 font-semibold text-white' : 'hover:bg-brand-50'}`}
              >
                {e[lang].name}
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-3">
          <div className="aspect-video overflow-hidden rounded-2xl bg-slate-100">
            <PuppetViewer exercise={PUPPET_EXERCISES[ex.id]} side={side} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{t('puppet.side')}:</span>
            {([null, 'left', 'right'] as const).map((s) => (
              <button
                key={s ?? 'auto'}
                onClick={() => setSide(s)}
                className={`rounded-full px-3 py-1 ring-1 ring-slate-200 ${side === s ? 'bg-brand-700 text-white' : 'bg-white'}`}
              >
                {s ? t(`workout.${s}`) : t('puppet.auto')}
              </button>
            ))}
          </div>
          <section className="card">
            <h2 className="mb-1 font-semibold">{ex[lang].name}</h2>
            <ol className="list-decimal space-y-1 pl-5 text-slate-700">
              {ex[lang].instructions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
