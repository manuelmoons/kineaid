import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PuppetExercise } from './exercises';
import { lookFor } from './rig';
import { PuppetScene } from './scene';

type Figure = 'auto' | 'male' | 'female';
const FIGURE_KEY = 'kineaid.figure';
const FIGURES: Figure[] = ['auto', 'female', 'male'];

function readFigure(): Figure {
  try {
    const v = localStorage.getItem(FIGURE_KEY);
    return v === 'male' || v === 'female' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * Animated 3D figure showing one exercise. Drag to rotate the view.
 * `seed` (e.g. the exercise id) picks the figure: sometimes a man, sometimes a woman, with varied
 * skin and hair. The viewer can fix it to a man or a woman (remembered on this device).
 */
export default function PuppetViewer({ exercise, side = null, seed = 'kineaid' }: { exercise: PuppetExercise; side?: 'left' | 'right' | null; seed?: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PuppetScene | null>(null);
  const [shownSide, setShownSide] = useState<'left' | 'right' | null>(null);
  const [failed, setFailed] = useState(false);
  const [figure, setFigure] = useState<Figure>(readFigure);
  const look = useMemo(() => lookFor(seed, figure === 'auto' ? undefined : figure), [seed, figure]);
  const firstLook = useRef(look);

  useEffect(() => {
    if (!ref.current) return;
    let scene: PuppetScene;
    try {
      scene = new PuppetScene(ref.current, firstLook.current);
    } catch {
      setFailed(true); // no WebGL
      return;
    }
    sceneRef.current = scene;
    if (import.meta.env.DEV) (window as unknown as { __puppet: PuppetScene }).__puppet = scene;
    scene.onSideChange = setShownSide;
    // Only animate while visible (e.g. not inside a collapsed <details>).
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? scene.play() : scene.stop()));
    io.observe(ref.current);
    return () => {
      io.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setExercise(exercise, side);
  }, [exercise, side]);

  useEffect(() => {
    if (look === firstLook.current) return;
    sceneRef.current?.setLook(look);
  }, [look]);

  const nextFigure = () => {
    const next = FIGURES[(FIGURES.indexOf(figure) + 1) % FIGURES.length];
    setFigure(next);
    try {
      localStorage.setItem(FIGURE_KEY, next);
    } catch {
      /* private mode: just not remembered */
    }
  };

  if (failed) return <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">3D not available</div>;

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full cursor-grab active:cursor-grabbing" />
      {shownSide && (
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-brand-700 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          {t(`workout.${shownSide}`)}
        </span>
      )}
      <button
        type="button"
        onClick={nextFigure}
        title={t('puppet.figureTitle')}
        className="absolute right-2 top-2 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700 shadow ring-1 ring-slate-200 hover:bg-white"
      >
        {t(`puppet.figure.${figure}`)}
      </button>
      <button
        type="button"
        onClick={() => sceneRef.current?.resetView()}
        aria-label={t('puppet.resetView')}
        title={t('puppet.resetView')}
        className="absolute bottom-2 right-2 rounded-full bg-white/80 px-2.5 py-1 text-sm text-slate-700 shadow ring-1 ring-slate-200 hover:bg-white"
      >
        ↺
      </button>
    </div>
  );
}
