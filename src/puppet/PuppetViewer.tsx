import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PuppetExercise } from './exercises';
import { PuppetScene } from './scene';

/** Animated 3D mannequin showing one exercise. Drag to rotate the view. */
export default function PuppetViewer({ exercise, side = null }: { exercise: PuppetExercise; side?: 'left' | 'right' | null }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PuppetScene | null>(null);
  const [shownSide, setShownSide] = useState<'left' | 'right' | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    let scene: PuppetScene;
    try {
      scene = new PuppetScene(ref.current);
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
