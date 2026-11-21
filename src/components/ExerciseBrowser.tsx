import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BODY_PARTS, type BodyPart } from '../lib/bodyParts';
import { normalizeLang, searchExercises, type ExerciseSummary } from '../lib/exercises';
import ExerciseThumb from './ExerciseThumb';

const PAGE_SIZE = 24;

interface Props {
  /** When set, cards get an "add" button instead of linking to the detail page. */
  onPick?: (exercise: ExerciseSummary) => void;
  pickedIds?: Set<string>;
}

export default function ExerciseBrowser({ onPick, pickedIds }: Props) {
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.resolvedLanguage);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [items, setItems] = useState<ExerciseSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  // New search → start from page 0
  useEffect(() => setPage(0), [debouncedQ, bodyPart, lang]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchExercises({ q: debouncedQ, bodyPart, lang, page, pageSize: PAGE_SIZE })
      .then(({ items: newItems, total }) => {
        if (cancelled) return;
        setItems((prev) => (page === 0 ? newItems : [...prev, ...newItems]));
        setTotal(total);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, bodyPart, lang, page]);

  return (
    <div className="space-y-4">
      <input
        type="search"
        className="input"
        placeholder={t('library.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={t('library.search')}
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t('library.bodyPart')}>
        <Chip active={!bodyPart} onClick={() => setBodyPart(null)}>
          {t('library.all')}
        </Chip>
        {BODY_PARTS.map((p) => (
          <Chip key={p} active={bodyPart === p} onClick={() => setBodyPart(bodyPart === p ? null : p)}>
            {t(`bodyParts.${p}`)}
          </Chip>
        ))}
      </div>

      <p className="text-sm text-slate-500" aria-live="polite">
        {loading && page === 0 ? t('app.loading') : t('library.results', { count: total })}
      </p>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((ex) => {
          const picked = pickedIds?.has(ex.id);
          const body = (
            <>
              <div className="aspect-square overflow-hidden bg-slate-100">
                <ExerciseThumb url={ex.image_url} bodyParts={ex.body_parts} />
              </div>
              <div className="space-y-1 p-2">
                <p className="line-clamp-2 text-sm font-semibold leading-tight">{ex.name}</p>
                <p className="text-xs text-slate-500">
                  {ex.kind === 'time' ? t('exercise.kindTime') : t('exercise.kindReps')}
                  {ex.owner_id && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">{t('library.own')}</span>}
                </p>
              </div>
            </>
          );
          return (
            <li key={ex.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              {onPick ? (
                <button
                  type="button"
                  onClick={() => onPick(ex)}
                  className={`block w-full text-left ${picked ? 'opacity-60' : 'hover:bg-brand-50'}`}
                >
                  {body}
                  <span className="block border-t border-slate-100 py-2 text-center text-sm font-semibold text-brand-700">
                    {picked ? `✓ ${t('library.added')}` : `+ ${t('library.add')}`}
                  </span>
                </button>
              ) : (
                <Link to={`/exercise/${ex.id}`} className="block hover:bg-brand-50">
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {items.length < total && (
        <button className="btn-secondary w-full" disabled={loading} onClick={() => setPage((p) => p + 1)}>
          {loading ? t('app.loading') : t('library.more')}
        </button>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
        active ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}
