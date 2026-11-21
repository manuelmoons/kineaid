import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { getExercise, normalizeLang, pickTranslation, type ExerciseSummary } from '../lib/exercises';
import {
  addProgramItem,
  deleteProgram,
  deleteProgramItem,
  getProgram,
  updateProgram,
  updateProgramItem,
  type ItemPatch,
  type ProgramItem,
  type ProgramWithItems,
} from '../lib/programs';
import ExerciseBrowser from '../components/ExerciseBrowser';
import ExerciseThumb from '../components/ExerciseThumb';
import Modal from '../components/Modal';

export default function ProgramEditor() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [program, setProgram] = useState<ProgramWithItems | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => getProgram(id).then(setProgram).catch((e) => setError(e.message)), [id]);
  useEffect(() => {
    reload();
  }, [reload]);

  const pickedIds = useMemo(() => new Set(program?.program_items.map((i) => i.exercise_id)), [program]);

  if (error) return <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>;
  if (!program || !profile) return <p className="p-8 text-center text-slate-500">{t('app.loading')}</p>;

  const canEdit = program.kine_id === profile.id || (program.patient_id === profile.id && !program.kine_id);
  const items = program.program_items;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const add = (ex: ExerciseSummary) => {
    if (pickedIds.has(ex.id)) return;
    run(async () => {
      const full = await getExercise(ex.id);
      const nextPos = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
      await addProgramItem(program.id, full, nextPos);
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const other = items[index + dir];
    if (!other) return;
    const a = items[index];
    run(async () => {
      await updateProgramItem(a.id, { position: other.position });
      await updateProgramItem(other.id, { position: a.position === other.position ? a.position + dir : a.position });
    });
  };

  const backTo = program.kine_id === profile.id ? `/kine/patients/${program.patient_id}` : '/patient';

  return (
    <div className="space-y-5">
      <Link to={backTo} className="text-sm text-brand-700 hover:underline">
        ← {t('app.back')}
      </Link>

      {canEdit ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-slate-500">{t('program.name')}</span>
            <input
              className="input mt-1 text-lg font-semibold"
              defaultValue={program.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== program.name && run(() => updateProgram(program.id, { name: e.target.value.trim() }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={program.active} onChange={(e) => run(() => updateProgram(program.id, { active: e.target.checked }))} />
            {t('program.active')}
          </label>
        </div>
      ) : (
        <h1 className="text-2xl font-bold">{program.name}</h1>
      )}

      {items.length === 0 && <p className="card text-slate-500">{t('program.empty')}</p>}

      <ol className="space-y-3">
        {items.map((item, i) => (
          <ItemRow
            key={item.id}
            item={item}
            canEdit={canEdit}
            first={i === 0}
            last={i === items.length - 1}
            busy={busy}
            onMove={(dir) => move(i, dir)}
            onDelete={() => run(() => deleteProgramItem(item.id))}
            onChange={(patch) => run(() => updateProgramItem(item.id, patch))}
          />
        ))}
      </ol>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setPicking(true)}>
            + {t('program.addExercise')}
          </button>
          {items.length > 0 && (
            <Link to={`/workout/${program.id}`} className="btn-secondary">
              ▶ {t('workout.start')}
            </Link>
          )}
          <button
            className="btn ml-auto text-red-700 hover:bg-red-50"
            onClick={() => {
              if (window.confirm(t('program.confirmDelete'))) run(() => deleteProgram(program.id)).then(() => navigate(backTo));
            }}
          >
            {t('program.delete')}
          </button>
        </div>
      )}

      {picking && (
        <Modal title={t('program.addExercise')} onClose={() => setPicking(false)}>
          <ExerciseBrowser onPick={add} pickedIds={pickedIds} />
        </Modal>
      )}
    </div>
  );
}

function ItemRow({
  item,
  canEdit,
  first,
  last,
  busy,
  onMove,
  onDelete,
  onChange,
}: {
  item: ProgramItem;
  canEdit: boolean;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onChange: (patch: ItemPatch) => void;
}) {
  const { t, i18n } = useTranslation();
  const ex = item.exercises;
  const tr = pickTranslation(ex.exercise_translations, normalizeLang(i18n.resolvedLanguage));
  const image = [...(ex.exercise_images ?? [])].sort((a, b) => a.position - b.position)[0]?.url;
  const isTime = ex.kind === 'time';

  const num = (field: keyof ItemPatch, label: string, value: number | null, opts: { min?: number; optional?: boolean; suffix?: string } = {}) => (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          min={opts.min ?? (opts.optional ? 0 : 1)}
          className="input px-2 py-2 text-center"
          defaultValue={value ?? ''}
          disabled={!canEdit}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const v = raw === '' ? null : Math.max(opts.min ?? 0, parseInt(raw, 10));
            if (v === null && !opts.optional) return;
            if (v !== value) onChange({ [field]: v } as ItemPatch);
          }}
        />
        {opts.suffix && <span className="text-xs text-slate-500">{opts.suffix}</span>}
      </div>
    </label>
  );

  return (
    <li className="card space-y-3 p-4">
      <div className="flex gap-3">
        <Link to={`/exercise/${ex.id}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
          <ExerciseThumb url={image} bodyParts={ex.body_parts} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/exercise/${ex.id}`} className="font-semibold hover:underline">
            {tr?.name}
          </Link>
          <p className="text-xs text-slate-500">
            {isTime ? t('exercise.kindTime') : t('exercise.kindReps')}
            {ex.per_side && ` · ${t('exercise.perSide')}`}
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 flex-col gap-1">
            <button disabled={first || busy} onClick={() => onMove(-1)} className="rounded px-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={t('program.moveUp')}>
              ▲
            </button>
            <button disabled={last || busy} onClick={() => onMove(1)} className="rounded px-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={t('program.moveDown')}>
              ▼
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {num('sets', t('program.sets'), item.sets)}
        {isTime
          ? num('reps', t('program.repsPerSet'), item.reps, { optional: true })
          : num('reps', t('program.reps'), item.reps)}
        {isTime && num('hold_sec', t('program.hold'), item.hold_sec, { suffix: 's' })}
        {num('rest_sec', t('program.rest'), item.rest_sec, { min: 0, suffix: 's' })}
        {num('times_per_day', t('program.timesPerDay'), item.times_per_day)}
        {num('days_per_week', t('program.daysPerWeek'), item.days_per_week)}
      </div>

      {canEdit ? (
        <label className="block">
          <span className="text-xs text-slate-500">{t('program.note')}</span>
          <textarea
            className="input min-h-[2.75rem] py-2"
            rows={1}
            defaultValue={item.note ?? ''}
            onBlur={(e) => e.target.value !== (item.note ?? '') && onChange({ note: e.target.value || null })}
          />
        </label>
      ) : (
        item.note && <p className="rounded-lg bg-brand-50 p-2 text-sm text-brand-800">{item.note}</p>
      )}

      {canEdit && (
        <button onClick={onDelete} disabled={busy} className="text-sm text-red-700 hover:underline">
          {t('program.removeExercise')}
        </button>
      )}
    </li>
  );
}
