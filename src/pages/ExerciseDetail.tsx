import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getExercise, normalizeLang, pickTranslation, type Exercise } from '../lib/exercises';
import ExerciseInfo from '../components/ExerciseInfo';

export default function ExerciseDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getExercise(id).then(setExercise).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>;
  if (!exercise) return <p className="p-8 text-center text-slate-500">{t('app.loading')}</p>;

  const tr = pickTranslation(exercise.exercise_translations, normalizeLang(i18n.resolvedLanguage));
  const d = exercise;
  const dosage =
    d.kind === 'time'
      ? t('exercise.defaultTime', { sets: d.default_sets, hold: d.default_hold_sec ?? 30 })
      : t('exercise.defaultReps', { sets: d.default_sets, reps: d.default_reps ?? 10 });

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="text-sm text-brand-700 hover:underline">
        ← {t('app.back')}
      </button>
      <div>
        <h1 className="text-2xl font-bold">{tr?.name}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {d.body_parts.map((p) => (
            <span key={p} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
              {t(`bodyParts.${p}`)}
            </span>
          ))}
          {d.equipment && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{d.equipment}</span>}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {t('exercise.suggested')}: {dosage}
        </p>
      </div>
      <ExerciseInfo exercise={exercise} />
    </div>
  );
}
