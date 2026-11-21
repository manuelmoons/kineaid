import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { normalizeLang, pickTranslation } from '../lib/exercises';
import { completeSession, getProgram, logExercise, startSession, type ProgramItem, type ProgramWithItems } from '../lib/programs';
import { beep, keepScreenOn, unlockAudio } from '../lib/feedback';
import ExerciseInfo from '../components/ExerciseInfo';

type Phase = 'ready' | 'hold' | 'relax' | 'rest' | 'done';
const RELAX_SEC = 3; // pause between holds within one set

interface ItemState {
  setsDone: number;
  completed: boolean;
  skipped: boolean;
}

export default function Workout() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [program, setProgram] = useState<ProgramWithItems | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [states, setStates] = useState<ItemState[]>([]);
  const [finished, setFinished] = useState(false);
  const sessionId = useRef<string | null>(null);

  useEffect(() => {
    getProgram(id)
      .then((p) => {
        setProgram(p);
        setStates(p.program_items.map(() => ({ setsDone: 0, completed: false, skipped: false })));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => keepScreenOn(), []);

  const isPatient = !!program && program.patient_id === profile?.id;

  const ensureSession = useCallback(async () => {
    if (!isPatient || !program || !profile || sessionId.current) return;
    sessionId.current = await startSession(program.id, profile.id);
  }, [isPatient, program, profile]);

  if (error) return <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>;
  if (!program) return <p className="p-8 text-center text-slate-500">{t('app.loading')}</p>;
  const items = program.program_items;
  if (!items.length) return <p className="card">{t('program.empty')}</p>;

  const finishItem = async (i: number, setsDone: number, completed: boolean) => {
    setStates((prev) => prev.map((s, j) => (j === i ? { setsDone, completed, skipped: !completed } : s)));
    try {
      await ensureSession();
      if (sessionId.current) await logExercise(sessionId.current, items[i].id, setsDone, completed);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const goNext = async () => {
    const next = states.findIndex((s, j) => j > index && !s.completed && !s.skipped);
    if (next !== -1) return setIndex(next);
    const anyOpen = states.findIndex((s) => !s.completed && !s.skipped);
    if (anyOpen !== -1) return setIndex(anyOpen);
    try {
      if (sessionId.current) await completeSession(sessionId.current);
    } catch (e) {
      setError((e as Error).message);
    }
    beep('done');
    setFinished(true);
  };

  if (finished) {
    const done = states.filter((s) => s.completed).length;
    return (
      <div className="card mx-auto max-w-md space-y-4 text-center">
        <p className="text-5xl">🎉</p>
        <h1 className="text-2xl font-bold">{t('workout.finished')}</h1>
        <p className="text-slate-600">{t('workout.summary', { done, total: items.length })}</p>
        {!isPatient && <p className="text-sm text-slate-500">{t('workout.previewNote')}</p>}
        <Link to="/" className="btn-primary w-full">
          {t('workout.backHome')}
        </Link>
      </div>
    );
  }

  const item = items[index];
  const state = states[index];
  const otherOpen = states.some((s, j) => j !== index && !s.completed && !s.skipped);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className="text-sm text-brand-700 hover:underline">
          ✕ {t('workout.stop')}
        </Link>
        <p className="text-sm font-medium text-slate-600">
          {t('workout.progress', { n: index + 1, total: items.length })}
        </p>
      </div>

      <nav className="flex gap-1.5" aria-label={t('workout.exercises')}>
        {items.map((it, i) => {
          const s = states[i];
          const color = s?.completed ? 'bg-brand-600' : s?.skipped ? 'bg-slate-300' : i === index ? 'bg-brand-300' : 'bg-slate-200';
          return (
            <button
              key={it.id}
              onClick={() => setIndex(i)}
              className={`h-2.5 flex-1 rounded-full ${color} ${i === index ? 'ring-2 ring-brand-700 ring-offset-1' : ''}`}
              aria-label={t('workout.goTo', { n: i + 1 })}
              aria-current={i === index}
            />
          );
        })}
      </nav>

      {!isPatient && <p className="rounded-xl bg-slate-100 p-2 text-center text-xs text-slate-600">{t('workout.previewNote')}</p>}

      <ExercisePlayer
        key={item.id}
        item={item}
        state={state}
        onStarted={ensureSession}
        onFinish={(setsDone, completed) => finishItem(index, setsDone, completed)}
        onNext={goNext}
        isLast={!otherOpen}
      />
    </div>
  );
}

function ExercisePlayer({
  item,
  state,
  onStarted,
  onFinish,
  onNext,
  isLast,
}: {
  item: ProgramItem;
  state: ItemState;
  onStarted: () => void;
  onFinish: (setsDone: number, completed: boolean) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const { t, i18n } = useTranslation();
  const ex = item.exercises;
  const tr = pickTranslation(ex.exercise_translations, normalizeLang(i18n.resolvedLanguage));
  const isTime = ex.kind === 'time';
  const repsPerSet = isTime ? Math.max(1, item.reps ?? 1) : item.reps ?? 10;
  const holdSec = item.hold_sec ?? 30;

  const alreadyDone = state.completed || state.skipped;
  const [setsDone, setSetsDone] = useState(state.setsDone);
  const [repInSet, setRepInSet] = useState(0);
  const [phase, setPhase] = useState<Phase>(alreadyDone ? 'done' : 'ready');
  const [remaining, setRemaining] = useState(0); // ms
  const [paused, setPaused] = useState(false);
  const endAt = useRef(0);
  const lastTick = useRef(0);

  const startTimer = (sec: number, next: Phase) => {
    endAt.current = Date.now() + sec * 1000;
    lastTick.current = sec;
    setRemaining(sec * 1000);
    setPaused(false);
    setPhase(next);
  };

  const completeSet = useCallback(() => {
    const done = setsDone + 1;
    setSetsDone(done);
    setRepInSet(0);
    if (done >= item.sets) {
      beep('done');
      setPhase('done');
      onFinish(done, true);
    } else if (item.rest_sec > 0) {
      beep('go');
      startTimer(item.rest_sec, 'rest');
    } else {
      setPhase('ready');
    }
  }, [setsDone, item.sets, item.rest_sec, onFinish]);

  // Countdown loop
  useEffect(() => {
    if (!['hold', 'relax', 'rest'].includes(phase) || paused) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, endAt.current - Date.now());
      setRemaining(left);
      const secLeft = Math.ceil(left / 1000);
      if (secLeft !== lastTick.current) {
        lastTick.current = secLeft;
        if (secLeft > 0 && secLeft <= 3) beep('tick');
      }
      if (left > 0) return;
      window.clearInterval(timer);
      if (phase === 'hold') {
        const rep = repInSet + 1;
        if (rep >= repsPerSet) completeSet();
        else {
          beep('go');
          setRepInSet(rep);
          startTimer(RELAX_SEC, 'relax');
        }
      } else if (phase === 'relax') {
        beep('go');
        startTimer(holdSec, 'hold');
      } else if (phase === 'rest') {
        beep('go');
        setPhase('ready');
      }
    }, 200);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, repInSet]);

  const togglePause = () => {
    if (paused) {
      endAt.current = Date.now() + remaining;
      setPaused(false);
    } else {
      setRemaining(Math.max(0, endAt.current - Date.now()));
      setPaused(true);
    }
  };

  const start = () => {
    unlockAudio();
    onStarted();
    beep('go');
    if (isTime) startTimer(holdSec, 'hold');
  };

  const secs = Math.ceil(remaining / 1000);
  const total = phase === 'hold' ? holdSec : phase === 'rest' ? item.rest_sec : RELAX_SEC;
  const fraction = total > 0 ? remaining / (total * 1000) : 0;

  const dosage = isTime
    ? item.reps && item.reps > 1
      ? t('workout.doseTimeReps', { sets: item.sets, reps: item.reps, hold: holdSec })
      : t('workout.doseTime', { sets: item.sets, hold: holdSec })
    : t('workout.doseReps', { sets: item.sets, reps: repsPerSet });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{tr?.name}</h1>
        <p className="font-medium text-brand-800">{dosage}</p>
        {item.note && <p className="mt-2 rounded-lg bg-brand-50 p-2 text-sm text-brand-800">💬 {item.note}</p>}
      </div>

      {/* Control panel */}
      <section className="card space-y-4 text-center">
        <p className="text-sm font-medium text-slate-500">
          {phase === 'done'
            ? t('workout.setsDone', { n: Math.min(setsDone, item.sets), total: item.sets })
            : t('workout.setOf', { n: Math.min(setsDone + 1, item.sets), total: item.sets })}
          {isTime && repsPerSet > 1 && phase !== 'done' && <> · {t('workout.repOf', { n: repInSet + 1, total: repsPerSet })}</>}
        </p>

        {(phase === 'hold' || phase === 'relax' || phase === 'rest') && (
          <div className="space-y-3">
            <TimerRing fraction={fraction} label={String(secs)} sub={t(`workout.phase.${phase}`)} tone={phase === 'hold' ? 'brand' : 'slate'} />
            <div className="flex justify-center gap-2">
              <button className="btn-secondary" onClick={togglePause}>
                {paused ? `▶ ${t('workout.resume')}` : `❚❚ ${t('workout.pause')}`}
              </button>
              {phase === 'rest' && (
                <button className="btn-secondary" onClick={() => setPhase('ready')}>
                  ⏭ {t('workout.skipRest')}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'ready' && (
          <div className="space-y-3">
            {isTime ? (
              <button className="btn-primary h-20 w-full text-xl" onClick={start}>
                ▶ {setsDone === 0 ? t('workout.startTimer') : t('workout.nextSet')}
              </button>
            ) : (
              <>
                <p className="text-4xl font-bold text-brand-800">{t('workout.repsBig', { reps: repsPerSet })}</p>
                <button
                  className="btn-primary h-20 w-full text-xl"
                  onClick={() => {
                    unlockAudio();
                    onStarted();
                    completeSet();
                  }}
                >
                  ✓ {t('workout.setDone')}
                </button>
              </>
            )}
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-3">
            <p className="text-lg font-semibold text-brand-800">{state.skipped ? t('workout.skipped') : `✓ ${t('workout.exerciseDone')}`}</p>
            <button className="btn-primary h-16 w-full text-lg" onClick={onNext}>
              {isLast ? t('workout.finish') : `${t('workout.next')} →`}
            </button>
          </div>
        )}

        {phase !== 'done' && (
          <div className="flex justify-center gap-4 text-sm">
            <button
              className="text-brand-700 hover:underline"
              onClick={() => {
                setSetsDone(item.sets);
                setPhase('done');
                beep('done');
                onFinish(item.sets, true);
              }}
            >
              ✓ {t('workout.markComplete')}
            </button>
            <button
              className="text-slate-500 hover:underline"
              onClick={() => {
                setPhase('done');
                onFinish(setsDone, false);
              }}
            >
              {t('workout.skip')}
            </button>
          </div>
        )}
      </section>

      <details className="card" open={phase === 'ready' && setsDone === 0}>
        <summary className="cursor-pointer font-semibold">{t('workout.howTo')}</summary>
        <div className="mt-3">
          <ExerciseInfo exercise={ex} compact />
        </div>
      </details>
    </div>
  );
}

function TimerRing({ fraction, label, sub, tone }: { fraction: number; label: string; sub: string; tone: 'brand' | 'slate' }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-48 w-48" role="timer" aria-live="off">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={tone === 'brand' ? '#0f766e' : '#94a3b8'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))}
          style={{ transition: 'stroke-dashoffset 0.2s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tabular-nums">{label}</span>
        <span className="text-sm font-medium text-slate-500">{sub}</span>
      </div>
    </div>
  );
}
