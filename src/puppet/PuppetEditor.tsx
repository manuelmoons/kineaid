import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BASES, type BaseName, type Keyframe, type Prop, type PuppetExercise } from './exercises';
import { controlsFor, JOINT_GROUPS } from './controls';
import { mirrorName, type JointName, type PointName, type SegmentName, type Vec3 } from './rig';
import { PuppetScene } from './scene';

const BASE_NAMES = Object.keys(BASES) as BaseName[];

const DEFAULT_ANCHOR: Partial<Record<BaseName, PointName[]>> = {
  standing: ['l_sole', 'r_sole'],
  seated: ['l_sole', 'r_sole'],
  quadruped: ['l_knee', 'r_knee'],
  forearmKneeling: ['l_elbow', 'r_elbow'],
};
const LYING: BaseName[] = ['supine', 'hookLying', 'prone', 'sideLying', 'quadruped', 'forearmKneeling'];

const ANCHORS: Record<string, PointName[]> = {
  feet: ['l_sole', 'r_sole'],
  toes: ['l_toe', 'r_toe'],
  leftFoot: ['l_sole'],
  knees: ['l_knee', 'r_knee'],
  hands: ['l_hand', 'r_hand'],
  elbows: ['l_elbow', 'r_elbow'],
  pelvis: ['pelvis'],
};
const anchorKey = (a: PointName[] | undefined) =>
  Object.keys(ANCHORS).find((k) => ANCHORS[k].join() === (a ?? ['pelvis']).join()) ?? 'custom';

const SEGMENTS: SegmentName[] = [
  'head', 'neck', 'chest', 'abdomen', 'pelvis',
  'l_upperarm', 'l_forearm', 'l_hand', 'r_upperarm', 'r_forearm', 'r_hand',
  'l_thigh', 'l_shin', 'l_foot', 'r_thigh', 'r_shin', 'r_foot',
];

const PROP_PRESETS: Record<string, Prop[]> = {
  mat: [{ type: 'mat' }],
  chairSeat: [{ type: 'chair', ref: 'seat', at: 'pelvis', frame: 0, offset: [0, -0.135, 0.08] }],
  chairBeside: [{ type: 'chair', ref: 'back', at: 'r_hand', frame: 0, offset: [-0.02, -0.065, 0], rotY: -90 }],
  wallBehind: [{ type: 'wall', at: 'chest', frame: 0, offset: [0, 0, -0.13] }],
  wallFront: [{ type: 'wall', at: ['l_wrist', 'r_wrist'], frame: 0, offset: [0, 0, 0.045], rotY: 180 }],
  table: [{ type: 'table', at: 'r_hand', frame: 0, offset: [-0.25, -0.029, 0.1] }],
  roll: [{ type: 'roll', at: 'l_knee', frame: 0 }],
  band: [{ type: 'strap', from: 'l_hand', to: 'r_hand', color: 0xef4444 }],
  towelFoot: [
    { type: 'strap', from: 'l_hand', to: 'l_sole' },
    { type: 'strap', from: 'r_hand', to: 'l_sole' },
  ],
};

function newPuppet(base: BaseName): PuppetExercise {
  return {
    base,
    keyframes: [{ pose: {}, move: 1.2, hold: 1 }],
    anchor: DEFAULT_ANCHOR[base],
    props: base === 'seated' ? PROP_PRESETS.chairSeat : LYING.includes(base) ? PROP_PRESETS.mat : [],
    view: { az: 90, el: 12 },
    highlight: [],
  };
}

const round = (v: number) => Math.round(v);

/**
 * Pose the 3D puppet: choose a starting position, tap a body part (or pick a joint),
 * move it with sliders, and build the movement from keyframes.
 */
export default function PuppetEditor({
  value,
  onDone,
  onCancel,
}: {
  value: PuppetExercise | null;
  onDone: (puppet: PuppetExercise | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [puppet, setPuppet] = useState<PuppetExercise | null>(() => (value ? structuredClone(value) : null));
  const [frame, setFrame] = useState(0);
  const [joint, setJoint] = useState<JointName | null>(null);
  const [playing, setPlaying] = useState(false);
  const [viewSaved, setViewSaved] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PuppetScene | null>(null);
  const framed = useRef(false);
  const frameRef = useRef(0);

  // Create the 3D scene once there is a puppet to show.
  const hasPuppet = !!puppet;
  useEffect(() => {
    if (!hasPuppet || !box.current) return;
    const scene = new PuppetScene(box.current);
    sceneRef.current = scene;
    scene.onPick = (j) => {
      setJoint(j);
      setPlaying(false);
    };
    // Dragging a body part turns its joint in the position being edited.
    scene.onDrag = (j, rotation) => {
      setJoint(j);
      setPuppet((p) =>
        p && {
          ...p,
          keyframes: p.keyframes.map((k, i) => (i === frameRef.current ? { ...k, pose: { ...k.pose, [j]: rotation } } : k)),
        },
      );
    };
    // Fix walls, chairs, … in place, so changing a pose does not move them.
    setPuppet((p) => (p && p.props?.some((x) => 'at' in x && x.at) ? { ...p, props: scene.pinProps(p) } : p));
    scene.play();
    framed.current = false;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [hasPuppet]);

  // Push every change to the scene (keep the camera after the first time).
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !puppet) return;
    scene.setExercise(puppet, playing ? null : 'left', { keepCamera: framed.current });
    framed.current = true;
    scene.freeze(playing ? null : Math.min(frame, puppet.keyframes.length - 1));
    scene.setSelected(playing ? null : joint);
  }, [puppet, frame, joint, playing]);

  if (!puppet) {
    return (
      <div className="space-y-3">
        <p className="font-medium">{t('puppetEditor.chooseBase')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BASE_NAMES.map((b) => (
            <button key={b} type="button" className="btn-secondary h-16 text-sm" onClick={() => setPuppet(newPuppet(b))}>
              {t(`puppetEditor.bases.${b}`)}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t('program.cancel')}
          </button>
        </div>
      </div>
    );
  }

  const kfs = puppet.keyframes;
  const cur = Math.min(frame, kfs.length - 1);
  frameRef.current = cur;
  const pose = { ...BASES[puppet.base], ...kfs[cur].pose };
  const update = (patch: Partial<PuppetExercise>) => setPuppet({ ...puppet, ...patch });
  const setKeyframe = (i: number, patch: Partial<Keyframe>) => update({ keyframes: kfs.map((k, j) => (j === i ? { ...k, ...patch } : k)) });
  const setJointValue = (j: JointName, vec: Vec3) => setKeyframe(cur, { pose: { ...kfs[cur].pose, [j]: vec } });
  const rot = (j: JointName): Vec3 => [...(pose[j] ?? [0, 0, 0])] as Vec3;

  const addFrame = () => {
    const copy: Keyframe = { pose: structuredClone(kfs[cur].pose), move: 1.2, hold: 1 };
    update({ keyframes: [...kfs.slice(0, cur + 1), copy, ...kfs.slice(cur + 1)] });
    setFrame(cur + 1);
    setPlaying(false);
  };
  const deleteFrame = () => {
    if (kfs.length < 2) return;
    update({ keyframes: kfs.filter((_, i) => i !== cur) });
    setFrame(Math.max(0, cur - 1));
  };
  const moveFrame = (dir: -1 | 1) => {
    const list = [...kfs];
    [list[cur], list[cur + dir]] = [list[cur + dir], list[cur]];
    update({ keyframes: list });
    setFrame(cur + dir);
  };

  const mirrorJoint = () => {
    if (!joint || joint === mirrorName(joint)) return;
    const [x, y, z] = rot(joint);
    setJointValue(mirrorName(joint), [x, -y, -z]);
  };
  const resetJoint = () => {
    if (!joint) return;
    const p = { ...kfs[cur].pose };
    delete p[joint];
    setKeyframe(cur, { pose: p });
  };

  const saveView = () => {
    const v = sceneRef.current?.getView();
    if (!v) return;
    update({ view: { ...puppet.view, ...v } });
    setViewSaved(true);
    setTimeout(() => setViewSaved(false), 2000);
  };

  const props = puppet.props ?? [];
  const addPreset = (key: string) => {
    if (key === 'mat' && props.some((p) => p.type === 'mat')) return;
    const next = { ...puppet, props: [...props, ...structuredClone(PROP_PRESETS[key])] };
    update({ props: sceneRef.current ? sceneRef.current.pinProps(next) : next.props });
  };

  return (
    <div className="space-y-4">
      {/* Viewer */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100">
        <div ref={box} className="h-full w-full" />
        <div className="absolute left-2 top-2 rounded-full bg-white/90 px-3 py-0.5 text-xs font-semibold text-slate-700 shadow">
          {playing ? t('puppetEditor.playing') : t('puppetEditor.position', { n: cur + 1, total: kfs.length })}
        </div>
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="absolute bottom-2 left-2 rounded-full bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white shadow hover:bg-brand-800"
        >
          {playing ? `✎ ${t('puppetEditor.edit')}` : `▶ ${t('puppetEditor.play')}`}
        </button>
        <button
          type="button"
          onClick={saveView}
          className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow ring-1 ring-slate-200 hover:bg-white"
        >
          {viewSaved ? `✓ ${t('puppetEditor.viewSaved')}` : `🎥 ${t('puppetEditor.saveView')}`}
        </button>
        <button
          type="button"
          onClick={() => sceneRef.current?.resetView()}
          aria-label={t('puppet.resetView')}
          title={t('puppet.resetView')}
          className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2.5 py-1 text-sm text-slate-700 shadow ring-1 ring-slate-200"
        >
          ↺
        </button>
      </div>
      <p className="text-xs text-slate-500">{t('puppetEditor.tapHint')}</p>

      {/* Keyframes */}
      <section className="space-y-2">
        <p className="text-sm font-semibold">{t('puppetEditor.positions')}</p>
        <div className="flex flex-wrap items-center gap-2">
          {kfs.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setFrame(i);
                setPlaying(false);
              }}
              className={`h-10 min-w-10 rounded-full px-3 text-sm font-semibold ring-1 ${
                i === cur && !playing ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white ring-slate-300'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button type="button" className="h-10 rounded-full px-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-600" onClick={addFrame}>
            + {t('puppetEditor.addPosition')}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <NumberField label={t('puppetEditor.moveSec')} value={kfs[cur].move ?? 1} onChange={(v) => setKeyframe(cur, { move: v })} />
          <NumberField label={t('puppetEditor.holdSec')} value={kfs[cur].hold ?? 0} onChange={(v) => setKeyframe(cur, { hold: v })} />
          <div className="flex gap-1">
            <SmallButton disabled={cur === 0} onClick={() => moveFrame(-1)} label={t('puppetEditor.earlier')}>
              ←
            </SmallButton>
            <SmallButton disabled={cur === kfs.length - 1} onClick={() => moveFrame(1)} label={t('puppetEditor.later')}>
              →
            </SmallButton>
            <SmallButton disabled={kfs.length < 2} onClick={deleteFrame} label={t('puppetEditor.deletePosition')} danger>
              ✕
            </SmallButton>
          </div>
        </div>
      </section>

      {/* Joint */}
      <section className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <select
          className="input"
          value={joint ?? ''}
          onChange={(e) => {
            setJoint((e.target.value || null) as JointName | null);
            setPlaying(false);
          }}
          aria-label={t('puppetEditor.joint')}
        >
          <option value="">{t('puppetEditor.chooseJoint')}</option>
          {JOINT_GROUPS.map((g) => (
            <optgroup key={g.label} label={t(`puppetEditor.groups.${g.label}`)}>
              {g.joints.map((j) => (
                <option key={j} value={j}>
                  {t(`puppetEditor.joints.${j}`)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {joint && (
          <>
            {controlsFor(joint).map((c) => {
              const r = rot(joint);
              const v = round(r[c.axis] * c.sign);
              const set = (nv: number) => {
                const clamped = Math.max(c.min, Math.min(c.max, nv));
                const next = [...r] as Vec3;
                next[c.axis] = clamped * c.sign;
                setJointValue(joint, next);
              };
              return (
                <div key={c.axis}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{t(`puppetEditor.axes.${c.label}`)}</span>
                    <span className="flex items-center gap-1">
                      <SmallButton onClick={() => set(v - 5)} label="−5°">
                        −
                      </SmallButton>
                      <span className="w-12 text-center tabular-nums">{v}°</span>
                      <SmallButton onClick={() => set(v + 5)} label="+5°">
                        +
                      </SmallButton>
                    </span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-brand-700"
                    min={c.min}
                    max={c.max}
                    value={v}
                    onChange={(e) => set(Number(e.target.value))}
                    aria-label={t(`puppetEditor.axes.${c.label}`)}
                  />
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              {joint !== mirrorName(joint) && (
                <button type="button" className="btn-secondary py-2 text-sm" onClick={mirrorJoint}>
                  ⇄ {t('puppetEditor.mirrorJoint')}
                </button>
              )}
              <button type="button" className="btn-secondary py-2 text-sm" onClick={resetJoint}>
                ↺ {t('puppetEditor.resetJoint')}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Settings */}
      <details className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <summary className="cursor-pointer text-sm font-semibold">{t('puppetEditor.settings')}</summary>
        <div className="mt-3 space-y-4 text-sm">
          <Labeled label={t('puppetEditor.base')}>
            <select className="input" value={puppet.base} onChange={(e) => update({ base: e.target.value as BaseName })}>
              {BASE_NAMES.map((b) => (
                <option key={b} value={b}>
                  {t(`puppetEditor.bases.${b}`)}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label={t('puppetEditor.sides')}>
            <select className="input" value={puppet.sides ?? 'one'} onChange={(e) => update({ sides: e.target.value as 'one' | 'alternate' })}>
              <option value="one">{t('puppetEditor.sidesOne')}</option>
              <option value="alternate">{t('puppetEditor.sidesAlternate')}</option>
            </select>
          </Labeled>
          <Labeled label={t('puppetEditor.anchor')}>
            <select className="input" value={anchorKey(puppet.anchor)} onChange={(e) => update({ anchor: ANCHORS[e.target.value] })}>
              {anchorKey(puppet.anchor) === 'custom' && <option value="custom">{t('puppetEditor.anchors.custom')}</option>}
              {Object.keys(ANCHORS).map((k) => (
                <option key={k} value={k}>
                  {t(`puppetEditor.anchors.${k}`)}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label={t('puppetEditor.highlight')}>
            <div className="flex flex-wrap gap-1.5">
              {SEGMENTS.map((s) => {
                const on = puppet.highlight?.includes(s) ?? false;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ highlight: on ? puppet.highlight!.filter((x) => x !== s) : [...(puppet.highlight ?? []), s] })}
                    className={`rounded-full px-2.5 py-1 text-xs ring-1 ${on ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white ring-slate-300'}`}
                  >
                    {t(`puppetEditor.segments.${s}`)}
                  </button>
                );
              })}
            </div>
          </Labeled>
          <Labeled label={t('puppetEditor.props')}>
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {props.map((p, i) => (
                <li key={i} className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs">
                  {t(`puppetEditor.propTypes.${p.type}`)}
                  <button
                    type="button"
                    className="rounded-full px-1.5 text-red-600 hover:bg-red-50"
                    onClick={() => update({ props: props.filter((_, j) => j !== i) })}
                    aria-label={t('editor.removePhoto')}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <select className="input" value="" onChange={(e) => e.target.value && addPreset(e.target.value)} aria-label={t('puppetEditor.addProp')}>
              <option value="">+ {t('puppetEditor.addProp')}</option>
              {Object.keys(PROP_PRESETS).map((k) => (
                <option key={k} value={k}>
                  {t(`puppetEditor.presets.${k}`)}
                </option>
              ))}
            </select>
          </Labeled>
        </div>
      </details>

      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => setPuppet(null)}>
          {t('puppetEditor.startOver')}
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t('program.cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={() => onDone(puppet)}>
            ✓ {t('puppetEditor.done')}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-600">{label}</span>
      <input
        type="number"
        min={0}
        max={20}
        step={0.1}
        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5"
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
      />
    </label>
  );
}

function SmallButton({ children, onClick, disabled, label, danger }: { children: ReactNode; onClick: () => void; disabled?: boolean; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-slate-300 disabled:opacity-30 ${danger ? 'text-red-600' : ''}`}
    >
      {children}
    </button>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-medium text-slate-700">{label}</p>
      {children}
    </div>
  );
}
