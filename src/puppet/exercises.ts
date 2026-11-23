import type { PointName, Pose, SegmentName, Vec3 } from './rig';

/** Where a prop goes: the (averaged) world position of body point(s) in keyframe `frame`, plus an offset. */
export interface PropPlacement {
  at?: PointName | PointName[];
  frame?: number;
  offset?: Vec3;
  /** Rotation around the vertical axis, in degrees. 0 = the prop's front faces +Z. */
  rotY?: number;
}

export type Prop =
  | { type: 'mat' }
  /** `ref: 'seat'` places the seat top centre at the point; `'back'` places the top of the backrest there. */
  | ({ type: 'chair'; ref: 'seat' | 'back' } & PropPlacement)
  /** The point lies on the wall surface; the wall faces +Z (rotated by rotY). */
  | ({ type: 'wall' } & PropPlacement)
  /** The point is the centre of the table top. */
  | ({ type: 'table' } & PropPlacement)
  /** A rolled towel lying on the floor along X, under the point. */
  | ({ type: 'roll' } & PropPlacement)
  /** A towel/band drawn between two moving body points. */
  | { type: 'strap'; from: PointName; to: PointName; color?: number };

export interface Keyframe {
  pose: Pose;
  /** Seconds to move into this pose from the previous one (for keyframe 0: from the last one, when looping). */
  move?: number;
  /** Seconds to stay in this pose. */
  hold?: number;
}

export type BaseName = 'standing' | 'supine' | 'hookLying' | 'prone' | 'sideLying' | 'quadruped' | 'seated' | 'forearmKneeling';

export interface PuppetExercise {
  base: BaseName;
  keyframes: Keyframe[];
  /** Body points that stay in place horizontally (default: pelvis). Use LEFT names; they are mirrored for the right side. */
  anchor?: PointName[];
  props?: Prop[];
  /** Camera direction: azimuth (0 = in front of a standing figure, 90 = at its left side) and elevation, in degrees. */
  view?: { az: number; el: number; dist?: number; focus?: PointName };
  highlight?: SegmentName[];
  /** Exercise is authored for the LEFT side. 'alternate' shows left, then right. */
  sides?: 'one' | 'alternate';
  ease?: 'smooth' | 'linear';
}

// ─── Building blocks ─────────────────────────────────────────

/** Symmetric legs: hip flexion is negative, knee flexion positive, ankle plantarflexion positive. */
const legs = (hip: number, knee: number, ankle: number, abd = 0): Pose => ({
  l_hip: [hip, 0, abd],
  r_hip: [hip, 0, -abd],
  l_knee: [knee, 0, 0],
  r_knee: [knee, 0, 0],
  l_ankle: [ankle, 0, 0],
  r_ankle: [ankle, 0, 0],
});
/** Symmetric arms: shoulder flexion is negative, elbow flexion negative. */
const arms = (flex: number, elbow: number, abd = 7, rot = 0): Pose => ({
  l_shoulder: [flex, rot, abd],
  r_shoulder: [flex, -rot, -abd],
  l_elbow: [elbow, 0, 0],
  r_elbow: [elbow, 0, 0],
});

export const BASES: Record<BaseName, Pose> = {
  standing: { ...arms(0, -8, 7), ...legs(0, 0, 0, 2) },
  supine: { pelvis: [-90, 0, 0], ...arms(0, -5, 10), ...legs(0, 0, 15, 2) },
  hookLying: { pelvis: [-90, 0, 0], ...arms(0, -5, 12), ...legs(-50, 100, 40, 2) },
  prone: { pelvis: [90, 0, 0], ...arms(0, 0, 10), ...legs(0, 0, 60, 3) },
  sideLying: {
    pelvis: [-90, 0, 90],
    ...legs(-45, 90, 10),
    l_hip: [-45, 0, 0],
    r_hip: [-45, 0, 0],
    l_shoulder: [-35, 0, 5],
    l_elbow: [-30, 0, 0],
    r_shoulder: [-90, 0, 0],
    r_elbow: [-70, 0, 0],
  },
  quadruped: { pelvis: [80, 0, 0], ...legs(-80, 90, 75, 3), ...arms(-80, 0, 4), l_wrist: [90, 0, 0], r_wrist: [90, 0, 0], neck: [8, 0, 0] },
  seated: { ...legs(-90, 90, 0, 4), ...arms(-20, -55, 10) },
  forearmKneeling: { pelvis: [105, 0, 0], ...legs(-105, 90, 40, 3), ...arms(-105, -90, 8), neck: [-15, 0, 0] },
};

const SOLES: PointName[] = ['l_sole', 'r_sole'];
const TOES: PointName[] = ['l_toe', 'r_toe'];
const KNEES: PointName[] = ['l_knee', 'r_knee'];
const MAT: Prop = { type: 'mat' };

/** Points on a circle for circling motions (ankle alphabet, pendulum). */
const circle = (n: number, f: (cos: number, sin: number) => Pose, move: number): Keyframe[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { pose: f(Math.cos(a), Math.sin(a)), move };
  });

// ─── Exercises (keyed by KineAid source_id) ──────────────────

export const PUPPET_EXERCISES: Record<string, PuppetExercise> = {
  bridge: {
    base: 'hookLying',
    keyframes: [
      { pose: {}, move: 1.4, hold: 0.8 },
      { pose: { pelvis: [-115, 0, 0], ...legs(0, 75, 40, 2), neck: [25, 0, 0] }, move: 1.2, hold: 2 },
    ],
    anchor: SOLES,
    props: [MAT],
    view: { az: 90, el: 12 },
    highlight: ['pelvis'],
  },

  clamshell: {
    base: 'sideLying',
    keyframes: [
      { pose: {}, move: 1.2, hold: 0.6 },
      { pose: { l_hip: [-45, 40, 30] }, move: 1.2, hold: 0.8 },
    ],
    anchor: ['r_knee', 'pelvis'],
    props: [MAT],
    view: { az: 290, el: 55 },
    highlight: ['pelvis'],
  },

  'quad-set': {
    base: 'supine',
    keyframes: [
      { pose: { l_knee: [10, 0, 0], l_hip: [-4, 0, 2], l_ankle: [20, 0, 0] }, move: 1, hold: 1 },
      { pose: { l_knee: [0, 0, 0], l_hip: [0, 0, 2], l_ankle: [-8, 0, 0] }, move: 0.7, hold: 3 },
    ],
    props: [MAT, { type: 'roll', at: 'l_knee', frame: 0 }],
    view: { az: 90, el: 15 },
    highlight: ['l_thigh'],
  },

  'heel-slide': {
    base: 'supine',
    keyframes: [
      { pose: {}, move: 1.5, hold: 0.5 },
      { pose: { l_hip: [-60, 0, 2], l_knee: [115, 0, 0], l_ankle: [35, 0, 0] }, move: 1.5, hold: 0.5 },
    ],
    props: [MAT],
    view: { az: 90, el: 12 },
    highlight: ['l_thigh'],
  },

  'straight-leg-raise': {
    base: 'supine',
    keyframes: [
      { pose: { r_hip: [-50, 0, -2], r_knee: [100, 0, 0], r_ankle: [40, 0, 0], l_ankle: [-8, 0, 0] }, move: 1.5, hold: 0.5 },
      { pose: { r_hip: [-50, 0, -2], r_knee: [100, 0, 0], r_ankle: [40, 0, 0], l_ankle: [-8, 0, 0], l_hip: [-45, 0, 2] }, move: 1.5, hold: 1 },
    ],
    props: [MAT],
    view: { az: 90, el: 12 },
    highlight: ['l_thigh'],
  },

  'wall-sit': {
    base: 'standing',
    keyframes: [
      { pose: { pelvis: [-10, 0, 0], ...legs(-12, 0, 22, 3) }, move: 2, hold: 1 },
      { pose: { ...legs(-82, 82, 0, 3) }, move: 2, hold: 4 },
    ],
    anchor: SOLES,
    props: [{ type: 'wall', at: 'chest', frame: 1, offset: [0, 0, -0.13] }],
    view: { az: 90, el: 10 },
    highlight: ['l_thigh', 'r_thigh'],
  },

  'calf-raise': {
    base: 'standing',
    keyframes: [
      { pose: {}, move: 1.2, hold: 0.5 },
      { pose: { ...legs(0, 0, 35, 2) }, move: 1, hold: 1 },
    ],
    anchor: TOES,
    view: { az: 70, el: 10 },
    highlight: ['l_shin', 'r_shin'],
  },

  'ankle-alphabet': {
    base: 'seated',
    keyframes: circle(8, (c, s) => ({ l_hip: [-80, 0, 4], l_knee: [10, 0, 0], l_ankle: [10 + 25 * c, 25 * s, 0] }), 0.35),
    anchor: ['pelvis'],
    props: [{ type: 'chair', ref: 'seat', at: 'pelvis', frame: 0, offset: [0, -0.12, 0.08] }],
    view: { az: 55, el: 20 },
    highlight: ['l_foot'],
    ease: 'linear',
  },

  'single-leg-balance': {
    base: 'standing',
    keyframes: [
      { pose: { r_shoulder: [0, 0, -25], r_elbow: [-10, 0, 0] }, move: 1.2, hold: 0.8 },
      { pose: { r_shoulder: [0, 0, -25], r_elbow: [-10, 0, 0], l_hip: [-25, 0, 2], l_knee: [70, 0, 0], l_ankle: [10, 0, 0] }, move: 1, hold: 3 },
    ],
    anchor: ['r_sole'],
    props: [{ type: 'chair', ref: 'back', at: 'r_hand', frame: 0, offset: [-0.02, -0.03, 0], rotY: -90 }],
    view: { az: 30, el: 12 },
    highlight: ['r_thigh', 'r_shin', 'r_foot'],
  },

  pendulum: {
    base: 'standing',
    keyframes: circle(
      8,
      (c, s) => ({
        pelvis: [25, 0, 0],
        ...legs(-25, 0, 0, 4),
        spine: [20, 0, 0],
        chest: [25, 0, 0],
        neck: [-25, 0, 0],
        l_shoulder: [-70 + 12 * c, 0, 12 * s],
        l_elbow: [0, 0, 0],
        r_shoulder: [-55, 0, -5],
        r_elbow: [-15, 0, 0],
      }),
      0.4,
    ),
    anchor: SOLES,
    props: [{ type: 'table', at: 'r_hand', frame: 0, offset: [-0.1, -0.02, 0.1] }],
    view: { az: 55, el: 15 },
    highlight: ['l_upperarm'],
    ease: 'linear',
  },

  'wall-slide': {
    base: 'standing',
    keyframes: [
      { pose: { ...arms(-90, -90, 15) }, move: 1.5, hold: 0.5 },
      { pose: { pelvis: [8, 0, 0], ...legs(-8, 0, 0, 2), ...arms(-150, -15, 15) }, move: 1.5, hold: 0.5 },
    ],
    anchor: SOLES,
    props: [{ type: 'wall', at: ['l_wrist', 'r_wrist'], frame: 0, offset: [0, 0, 0.045], rotY: 180 }],
    view: { az: 55, el: 10 },
    highlight: ['l_upperarm', 'r_upperarm'],
  },

  'band-external-rotation': {
    base: 'standing',
    keyframes: [
      { pose: { ...arms(0, -90, 4) }, move: 1.2, hold: 0.4 },
      { pose: { ...arms(0, -90, 4, 45) }, move: 1, hold: 0.6 },
    ],
    anchor: SOLES,
    props: [{ type: 'strap', from: 'l_hand', to: 'r_hand', color: 0xef4444 }],
    view: { az: 20, el: 45 },
    highlight: ['l_upperarm', 'r_upperarm'],
  },

  'scapular-squeeze': {
    base: 'standing',
    keyframes: [
      { pose: {}, move: 1, hold: 1 },
      { pose: { l_clav: [0, 20, -5], r_clav: [0, -20, 5], chest: [-5, 0, 0], ...arms(10, -8, 10) }, move: 1, hold: 3 },
    ],
    anchor: SOLES,
    view: { az: 160, el: 25 },
    highlight: ['chest'],
  },

  'chin-tuck': {
    base: 'seated',
    keyframes: [
      { pose: {}, move: 1, hold: 1 },
      { pose: { neck: [-12, 0, 0], head: [14, 0, 0] }, move: 1, hold: 3 },
    ],
    props: [{ type: 'chair', ref: 'seat', at: 'pelvis', frame: 0, offset: [0, -0.12, 0.08] }],
    view: { az: 90, el: 5, dist: 1.7, focus: 'neck' },
    highlight: ['neck'],
  },

  'cat-camel': {
    base: 'quadruped',
    keyframes: [
      { pose: {}, move: 1.2, hold: 0.3 },
      { pose: { pelvis: [68, 0, 0], ...legs(-68, 90, 75, 3), spine: [25, 0, 0], chest: [12, 0, 0], ...arms(-105, 0, 4), neck: [35, 0, 0] }, move: 1.5, hold: 1 },
      { pose: {}, move: 1.2, hold: 0.3 },
      { pose: { pelvis: [92, 0, 0], ...legs(-92, 90, 75, 3), spine: [-15, 0, 0], chest: [-8, 0, 0], ...arms(-69, 0, 4), neck: [-25, 0, 0] }, move: 1.5, hold: 1 },
    ],
    anchor: KNEES,
    props: [MAT],
    view: { az: 90, el: 10 },
    highlight: ['abdomen', 'chest'],
  },

  'bird-dog': {
    base: 'quadruped',
    keyframes: [
      { pose: {}, move: 1.2, hold: 0.5 },
      { pose: { r_shoulder: [-170, 0, -4], r_elbow: [0, 0, 0], r_wrist: [0, 0, 0], l_hip: [10, 0, 3], l_knee: [0, 0, 0], l_ankle: [20, 0, 0] }, move: 1.2, hold: 2 },
    ],
    anchor: ['r_knee', 'l_hand'],
    props: [MAT],
    view: { az: 65, el: 20 },
    highlight: ['abdomen', 'pelvis'],
    sides: 'alternate',
  },

  'pelvic-tilt': {
    base: 'hookLying',
    keyframes: [
      { pose: {}, move: 1, hold: 0.8 },
      { pose: { pelvis: [-82, 0, 0], l_hip: [-58, 0, 2], r_hip: [-58, 0, -2], spine: [-8, 0, 0] }, move: 1, hold: 1.5 },
    ],
    anchor: SOLES,
    props: [MAT],
    view: { az: 90, el: 8 },
    highlight: ['abdomen', 'pelvis'],
  },

  'plank-knees': {
    base: 'forearmKneeling',
    keyframes: [
      { pose: {}, move: 1.5, hold: 0.8 },
      { pose: { pelvis: [71, 0, 0], ...legs(0, 90, 30, 3), ...arms(-71, -90, 8), neck: [0, 0, 0] }, move: 1.5, hold: 4 },
    ],
    anchor: ['l_elbow', 'r_elbow'],
    props: [MAT],
    view: { az: 90, el: 10 },
    highlight: ['abdomen'],
  },

  'hamstring-stretch': {
    base: 'supine',
    keyframes: [
      { pose: { l_hip: [-35, 0, 2], l_ankle: [0, 0, 0], ...arms(-50, -30, 6) }, move: 1.5, hold: 0.5 },
      { pose: { l_hip: [-75, 0, 2], l_ankle: [-10, 0, 0], ...arms(-75, -45, 6) }, move: 2, hold: 4 },
    ],
    props: [MAT, { type: 'strap', from: 'l_hand', to: 'l_sole' }, { type: 'strap', from: 'r_hand', to: 'l_sole' }],
    view: { az: 90, el: 10 },
    highlight: ['l_thigh'],
  },

  'sit-to-stand': {
    base: 'seated',
    keyframes: [
      { pose: { ...arms(-30, -20, 8) }, move: 1, hold: 0.6 },
      { pose: { pelvis: [35, 0, 0], ...legs(-125, 90, 0, 4), ...arms(-60, -15, 8) }, move: 0.8 },
      { pose: { ...legs(0, 0, 0, 3), ...arms(-10, -10, 8) }, move: 1.2, hold: 0.8 },
      { pose: { pelvis: [35, 0, 0], ...legs(-115, 70, 0, 4), ...arms(-55, -15, 8) }, move: 1.2 },
    ],
    anchor: SOLES,
    props: [{ type: 'chair', ref: 'seat', at: 'pelvis', frame: 0, offset: [0, -0.12, 0.09] }],
    view: { az: 90, el: 10 },
    highlight: ['l_thigh', 'r_thigh', 'pelvis'],
  },

  'knee-to-opposite-shoulder': {
    base: 'supine',
    keyframes: [
      { pose: { l_hip: [-110, 0, 0], l_knee: [110, 0, 0], r_shoulder: [-44, 0, 30], r_elbow: [0, 0, 0] }, move: 1.5, hold: 0.6 },
      { pose: { l_hip: [-115, -10, -20], l_knee: [110, 0, 0], r_shoulder: [-20, 0, 22], r_elbow: [-40, 0, 0] }, move: 1.5, hold: 4 },
    ],
    props: [MAT],
    view: { az: 60, el: 35 },
    highlight: ['pelvis'],
    sides: 'alternate',
  },

  'active-hamstring-stretch': {
    base: 'supine',
    keyframes: [
      { pose: { l_hip: [-90, 0, 0], l_knee: [90, 0, 0], l_ankle: [0, 0, 0], l_shoulder: [-18, 0, -4], r_shoulder: [-26, 0, 20], l_elbow: [-15, 0, 0], r_elbow: [0, 0, 0] }, move: 1.2, hold: 0.5 },
      { pose: { l_hip: [-90, 0, 0], l_knee: [20, 0, 0], l_ankle: [-10, 0, 0], l_shoulder: [-18, 0, -4], r_shoulder: [-26, 0, 20], l_elbow: [-15, 0, 0], r_elbow: [0, 0, 0] }, move: 1.5, hold: 1 },
    ],
    props: [MAT],
    view: { az: 90, el: 10 },
    highlight: ['l_thigh'],
    sides: 'alternate',
  },

  'figure-four-stretch': {
    base: 'hookLying',
    keyframes: [
      { pose: { l_hip: [-70, 75, 30], l_knee: [100, 0, 0], l_ankle: [0, 0, 0] }, move: 1.5, hold: 0.6 },
      { pose: { l_hip: [-110, 70, 30], l_knee: [100, 0, 0], l_ankle: [0, 0, 0], r_hip: [-95, 0, -2], r_knee: [100, 0, 0], l_shoulder: [-30, 0, -20], l_elbow: [0, 0, 0], r_shoulder: [-6, 0, 0], r_elbow: [-45, 0, 0] }, move: 1.5, hold: 4 },
    ],
    props: [MAT],
    view: { az: 60, el: 40 },
    highlight: ['pelvis', 'l_thigh'],
    sides: 'alternate',
  },

  'chair-supported-split-squat': {
    base: 'standing',
    keyframes: [
      {
        pose: { l_hip: [-27, 0, 3], l_knee: [5, 0, 0], l_ankle: [22, 0, 0], r_hip: [28, 0, -3], r_knee: [12, 0, 0], r_ankle: [20, 0, 0], ...arms(-45, -25, 8) },
        move: 1.5,
        hold: 0.6,
      },
      {
        pose: { l_hip: [-85, 0, 3], l_knee: [88, 0, 0], l_ankle: [-3, 0, 0], r_hip: [-2, 0, -3], r_knee: [92, 0, 0], r_ankle: [-5, 0, 0], ...arms(-62, -40, 8) },
        move: 1.5,
        hold: 0.6,
      },
    ],
    anchor: ['l_sole'],
    props: [{ type: 'chair', ref: 'back', at: ['l_hand', 'r_hand'], frame: 0, offset: [0, -0.03, 0.04] }],
    view: { az: 90, el: 10 },
    highlight: ['l_thigh', 'pelvis'],
    sides: 'alternate',
  },
};

export function puppetFor(source: string, sourceId: string | null | undefined): PuppetExercise | null {
  if (source !== 'kineaid' || !sourceId) return null;
  return PUPPET_EXERCISES[sourceId] ?? null;
}
