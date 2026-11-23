import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLang, pickTranslation, SOURCE_LABELS, type Exercise } from '../lib/exercises';
import ExerciseThumb from './ExerciseThumb';
import { puppetOf } from '../puppet/exercises';

const PuppetViewer = lazy(() => import('../puppet/PuppetViewer'));

/** Photos, instructions, "pay attention to" and credits of one exercise. */
export default function ExerciseInfo({
  exercise,
  compact = false,
  side = null,
}: {
  exercise: Exercise;
  compact?: boolean;
  /** Side currently being trained, for exercises done per side. */
  side?: 'left' | 'right' | null;
}) {
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.resolvedLanguage);
  const tr = pickTranslation(exercise.exercise_translations, lang);
  const images = [...(exercise.exercise_images ?? [])].sort((a, b) => a.position - b.position);
  const [imgIndex, setImgIndex] = useState(0);
  const source = SOURCE_LABELS[exercise.source];
  const translatedFallback = tr && tr.locale !== lang;
  const puppet = puppetOf(exercise);

  return (
    <div className="space-y-4">
      <div className={`relative overflow-hidden rounded-2xl bg-slate-100 ${compact ? 'aspect-[4/3]' : 'aspect-video'}`}>
        {puppet ? (
          <Suspense fallback={<ExerciseThumb url={null} bodyParts={exercise.body_parts} />}>
            <PuppetViewer exercise={puppet} side={side} />
          </Suspense>
        ) : (
          <ExerciseThumb key={images[imgIndex]?.url ?? 'none'} url={images[imgIndex]?.url} bodyParts={exercise.body_parts} alt={tr?.name} />
        )}
        {!puppet && images.length > 1 && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setImgIndex(i)}
                aria-label={t('exercise.photo', { n: i + 1 })}
                className={`h-2.5 w-2.5 rounded-full ring-1 ring-white ${i === imgIndex ? 'bg-brand-700' : 'bg-white/70'}`}
              />
            ))}
          </div>
        )}
      </div>

      {translatedFallback && <p className="text-xs text-slate-500">{t('exercise.onlyInEnglish')}</p>}
      {tr?.description && <p className="text-slate-700">{tr.description}</p>}

      {!!tr?.instructions?.length && (
        <section>
          <h3 className="mb-1 font-semibold">{t('exercise.instructions')}</h3>
          <ol className="list-decimal space-y-1 pl-5 text-slate-700">
            {tr.instructions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      {!!tr?.attention_points?.length && (
        <section className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <h3 className="mb-1 font-semibold text-amber-900">⚠ {t('exercise.attention')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-amber-900">
            {tr.attention_points.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {exercise.video_url && (
        <a href={exercise.video_url} target="_blank" rel="noreferrer" className="btn-secondary w-full">
          ▶ {t('exercise.video')}
        </a>
      )}

      <p className="text-xs text-slate-500">
        {t('exercise.source')}:{' '}
        {exercise.owner_id ? (
          <>
            {t('exercise.sourceOwn')}
            {exercise.author && (
              <>
                {' '}
                · {t('exercise.basedOn')}{' '}
                {exercise.source_url ? (
                  <a href={exercise.source_url} target="_blank" rel="noreferrer" className="underline">
                    {exercise.author}
                  </a>
                ) : (
                  exercise.author
                )}
                {exercise.license && ` (${exercise.license})`}
              </>
            )}
          </>
        ) : exercise.source_url || source?.url ? (
          <a href={exercise.source_url || source?.url} target="_blank" rel="noreferrer" className="underline">
            {source?.name ?? exercise.source}
          </a>
        ) : (
          source?.name ?? exercise.source
        )}
        {exercise.license && !exercise.owner_id && <> · {exercise.license}</>}
        {!exercise.owner_id && exercise.author && exercise.author !== source?.name && <> · {exercise.author}</>}
        {images[imgIndex]?.author && images[imgIndex].author !== exercise.author && (
          <>
            {' '}
            · {t('exercise.photoBy')} {images[imgIndex].author}
            {images[imgIndex].license && ` (${images[imgIndex].license})`}
          </>
        )}
      </p>
    </div>
  );
}
