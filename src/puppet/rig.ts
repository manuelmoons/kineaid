import * as THREE from 'three';

/**
 * A procedural, faceless mannequin built from simple shapes.
 *
 * Coordinate system: Y is up, the figure faces +Z when standing, +X is the figure's LEFT.
 * Every joint is an Object3D whose rotation (in degrees, see `Pose`) is applied in its parent's frame.
 *
 * Angle conventions (left side; the right side is the mirror image, see `mirrorPose`):
 *   pelvis   [pitch +=lean forward/face down, yaw, roll]  (order ZYX: pitch first, then yaw, then roll — all world axes)
 *   spine/chest/neck/head [+flex (bend forward), +twist to the left, +bend to the right]
 *   l_clav   [-, +retract (shoulder back), +elevate]
 *   l_shoulder [-flex / +extend, +external rotation, +abduct]
 *   l_elbow  [-flex]
 *   l_hip    [-flex / +extend, +external rotation, +abduct]
 *   l_knee   [+flex]
 *   l_ankle  [+plantarflex / -dorsiflex, +toes outward]
 */

export const JOINT_NAMES = [
  'pelvis', 'spine', 'chest', 'neck', 'head',
  'l_clav', 'l_shoulder', 'l_elbow', 'l_wrist',
  'r_clav', 'r_shoulder', 'r_elbow', 'r_wrist',
  'l_hip', 'l_knee', 'l_ankle',
  'r_hip', 'r_knee', 'r_ankle',
] as const;
export type JointName = (typeof JOINT_NAMES)[number];

/** Extra points (no rotation) used for anchoring, props and straps. */
export const MARKER_NAMES = ['l_hand', 'r_hand', 'l_toe', 'r_toe', 'l_heel', 'r_heel', 'l_sole', 'r_sole'] as const;
export type MarkerName = (typeof MARKER_NAMES)[number];
export type PointName = JointName | MarkerName;

export type Vec3 = [number, number, number];
/** Joint rotations in degrees, plus an optional horizontal root position [x, _, z] (height is automatic). */
export type Pose = Partial<Record<JointName, Vec3>> & { pos?: Vec3 };

export type SegmentName =
  | 'pelvis' | 'abdomen' | 'chest' | 'neck' | 'head'
  | 'l_upperarm' | 'l_forearm' | 'l_hand' | 'r_upperarm' | 'r_forearm' | 'r_hand'
  | 'l_thigh' | 'l_shin' | 'l_foot' | 'r_thigh' | 'r_shin' | 'r_foot';

interface JointDef {
  parent: JointName | null;
  offset: Vec3;
  order: THREE.EulerOrder;
}

const side = (x: number, s: 1 | -1): number => x * s;

function limbJoints(p: 'l' | 'r', s: 1 | -1): Record<string, JointDef> {
  return {
    [`${p}_clav`]: { parent: 'chest', offset: [side(0.03, s), 0.26, -0.01], order: 'XYZ' },
    [`${p}_shoulder`]: { parent: `${p}_clav` as JointName, offset: [side(0.165, s), 0, 0], order: 'XZY' },
    [`${p}_elbow`]: { parent: `${p}_shoulder` as JointName, offset: [0, -0.29, 0], order: 'XZY' },
    [`${p}_wrist`]: { parent: `${p}_elbow` as JointName, offset: [0, -0.26, 0], order: 'XZY' },
    [`${p}_hip`]: { parent: 'pelvis', offset: [side(0.095, s), -0.06, 0], order: 'XZY' },
    [`${p}_knee`]: { parent: `${p}_hip` as JointName, offset: [0, -0.43, 0], order: 'XZY' },
    [`${p}_ankle`]: { parent: `${p}_knee` as JointName, offset: [0, -0.42, 0], order: 'XZY' },
  };
}

export const JOINTS: Record<JointName, JointDef> = {
  pelvis: { parent: null, offset: [0, 0, 0], order: 'ZYX' },
  spine: { parent: 'pelvis', offset: [0, 0.07, 0], order: 'XZY' },
  chest: { parent: 'spine', offset: [0, 0.16, 0], order: 'XZY' },
  neck: { parent: 'chest', offset: [0, 0.3, -0.01], order: 'XZY' },
  head: { parent: 'neck', offset: [0, 0.08, 0.01], order: 'XZY' },
  ...(limbJoints('l', 1) as Record<string, JointDef>),
  ...(limbJoints('r', -1) as Record<string, JointDef>),
} as Record<JointName, JointDef>;

const MARKERS: Record<MarkerName, { parent: JointName; offset: Vec3 }> = {
  l_hand: { parent: 'l_wrist', offset: [0, -0.08, 0] },
  r_hand: { parent: 'r_wrist', offset: [0, -0.08, 0] },
  l_toe: { parent: 'l_ankle', offset: [0, -0.07, 0.16] },
  r_toe: { parent: 'r_ankle', offset: [0, -0.07, 0.16] },
  l_heel: { parent: 'l_ankle', offset: [0, -0.07, -0.05] },
  r_heel: { parent: 'r_ankle', offset: [0, -0.07, -0.05] },
  l_sole: { parent: 'l_ankle', offset: [0, -0.08, 0.06] },
  r_sole: { parent: 'r_ankle', offset: [0, -0.08, 0.06] },
};

const DEG = Math.PI / 180;

export interface Rig {
  root: THREE.Group;
  joints: Record<JointName, THREE.Object3D>;
  points: Record<PointName, THREE.Object3D>;
  segments: Record<SegmentName, THREE.Mesh[]>;
  bodyMeshes: THREE.Mesh[];
  setPose(pose: Pose): void;
  setHighlight(segments: SegmentName[]): void;
  /** Animate the highlight glow; call every frame with time in seconds. */
  tick(t: number): void;
  dispose(): void;
}

/**
 * How the figure looks. The skeleton (joint positions and limb lengths) is the same for every look,
 * so all poses, floor contacts and props stay correct; only the body shape, hair and colours change.
 */
export interface Look {
  body: 'male' | 'female';
  skin: number;
  hair: number;
  top: number;
  bottom: number;
}

export const SKIN_TONES = [0xf2cfb0, 0xdcae8c, 0xb47c56, 0x7b4f34] as const;
export const HAIR_COLORS = [0x3b2a1c, 0x16120f, 0xb08850, 0x7a3f22] as const;
const TOPS = { male: [0x4f7ca8, 0x3f8f7a, 0x5b5f97], female: [0xc8607a, 0x4f9a94, 0x7d63a8] } as const;
const BOTTOMS = { male: 0x334155, female: 0x2f3349 } as const;

export const DEFAULT_LOOK: Look = { body: 'male', skin: SKIN_TONES[1], hair: HAIR_COLORS[0], top: TOPS.male[0], bottom: BOTTOMS.male };

/** A stable look for a seed (e.g. the exercise id): sometimes a man, sometimes a woman, varied skin and hair. */
export function lookFor(seed: string, body?: 'male' | 'female'): Look {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const pick = <T,>(list: readonly T[], shift: number) => list[(h >>> shift) % list.length];
  const b = body ?? (h % 2 === 0 ? 'male' : 'female');
  return { body: b, skin: pick(SKIN_TONES, 3), hair: pick(HAIR_COLORS, 7), top: pick(TOPS[b], 11), bottom: BOTTOMS[b] };
}

const FIXED = { shoe: 0xf1f5f9, sole: 0x94a3b8, sock: 0xffffff, trim: 0xe2e8f0 } as const;
type ColorKind = 'skin' | 'hair' | 'top' | 'bottom' | keyof typeof FIXED;
export const HIGHLIGHT_COLOR = 0x14b8a6;

export function createRig(look: Look = DEFAULT_LOOK): Rig {
  const female = look.body === 'female';
  const colorOf = (k: ColorKind) => (k === 'skin' ? look.skin : k === 'hair' ? look.hair : k === 'top' ? look.top : k === 'bottom' ? look.bottom : FIXED[k]);

  const root = new THREE.Group();
  const joints = {} as Record<JointName, THREE.Object3D>;
  for (const name of JOINT_NAMES) {
    const o = new THREE.Object3D();
    o.name = name;
    const def = JOINTS[name];
    o.position.set(...def.offset);
    o.rotation.order = def.order;
    joints[name] = o;
  }
  for (const name of JOINT_NAMES) {
    const parent = JOINTS[name].parent;
    (parent ? joints[parent] : root).add(joints[name]);
  }
  const points = { ...joints } as Record<PointName, THREE.Object3D>;
  for (const name of MARKER_NAMES) {
    const o = new THREE.Object3D();
    o.position.set(...MARKERS[name].offset);
    joints[MARKERS[name].parent].add(o);
    points[name] = o;
  }

  const geos: THREE.BufferGeometry[] = [];
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  geos.push(sphere);
  const segments = {} as Record<SegmentName, THREE.Mesh[]>;
  const bodyMeshes: THREE.Mesh[] = [];
  // One material per (segment, colour), so a highlighted segment can glow while keeping its own base colour.
  const materials = new Map<string, { mat: THREE.MeshStandardMaterial; seg: SegmentName | null; base: THREE.Color }>();
  const matFor = (seg: SegmentName | null, kind: ColorKind) => {
    const key = `${seg ?? '-'}|${kind}`;
    let m = materials.get(key);
    if (!m) {
      const base = new THREE.Color(colorOf(kind));
      const rough = kind === 'shoe' || kind === 'sole' ? 0.5 : kind === 'hair' ? 0.85 : kind === 'skin' ? 0.6 : 0.8;
      m = { mat: new THREE.MeshStandardMaterial({ color: base.clone(), roughness: rough, metalness: 0 }), seg, base };
      materials.set(key, m);
    }
    return m.mat;
  };

  const add = (parent: JointName, geo: THREE.BufferGeometry, pos: Vec3, scale: Vec3, seg: SegmentName | null, kind: ColorKind, rot?: Vec3) => {
    const mesh = new THREE.Mesh(geo, matFor(seg, kind));
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    joints[parent].add(mesh);
    bodyMeshes.push(mesh);
    if (seg) (segments[seg] ??= []).push(mesh);
    return mesh;
  };
  const capsule = (radius: number, length: number) => {
    const g = new THREE.CapsuleGeometry(radius, length, 8, 20);
    geos.push(g);
    return g;
  };
  /** Tapered limb piece hanging down from its joint, from y = -top to y = -top - length. */
  const limb = (parent: JointName, rTop: number, rBottom: number, top: number, length: number, seg: SegmentName, kind: ColorKind) => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, length, 24, 1);
    geos.push(g);
    add(parent, g, [0, -top - length / 2, 0], [1, 1, 1], seg, kind);
  };
  /** Thin ring (hem of a sleeve or shorts leg, sock top) around a limb at height y. */
  const ring = (parent: JointName, r: number, y: number, seg: SegmentName, kind: ColorKind) => {
    const g = new THREE.TorusGeometry(r, 0.006, 8, 28);
    geos.push(g);
    add(parent, g, [0, y, 0], [1, 1, 1], seg, kind, [Math.PI / 2, 0, 0]);
  };
  const ball = (parent: JointName, r: number, kind: ColorKind, seg: SegmentName | null = null) => add(parent, sphere, [0, 0, 0], [r, r, r], seg, kind);

  // ── Trunk ── (women: narrower shoulders and waist, wider hips)
  const hipW = female ? 0.175 : 0.163;
  add('pelvis', sphere, [0, -0.01, 0], [hipW, 0.115, female ? 0.12 : 0.113], 'pelvis', 'bottom');
  const butt: Vec3 = female ? [0.092, 0.095, 0.085] : [0.082, 0.088, 0.078];
  for (const x of [-1, 1]) add('pelvis', sphere, [x * (female ? 0.072 : 0.066), -0.045, -0.045], butt, 'pelvis', 'bottom');
  add('spine', capsule(female ? 0.098 : 0.108, 0.07), [0, 0.08, 0], [1, 1, 0.8], 'abdomen', 'top');
  add('chest', sphere, [0, 0.14, -0.005], female ? [0.145, 0.19, 0.11] : [0.162, 0.2, 0.116], 'chest', 'top');
  add('chest', sphere, [0, 0.235, -0.012], female ? [0.168, 0.068, 0.095] : [0.192, 0.075, 0.1], 'chest', 'top'); // shoulder line
  // trapezius: a gentle slope from the neck to the shoulders
  for (const x of [-1, 1]) add('chest', sphere, [x * 0.08, 0.262, -0.022], female ? [0.07, 0.03, 0.05] : [0.08, 0.036, 0.058], 'chest', 'top');
  // front of the chest: one soft shape (a fuller, rounder one for the woman)
  add('chest', sphere, [0, female ? 0.15 : 0.17, female ? 0.05 : 0.03], female ? [0.118, 0.07, 0.07] : [0.14, 0.085, 0.085], 'chest', 'top');
  // waistband: smooth transition between T-shirt and shorts
  add('pelvis', sphere, [0, 0.055, 0], [hipW * 0.93, 0.045, female ? 0.1 : 0.098], 'pelvis', 'bottom');
  // ── Neck & head ──
  const neckGeo = new THREE.CylinderGeometry(female ? 0.039 : 0.045, female ? 0.045 : 0.052, 0.1, 20);
  geos.push(neckGeo);
  add('neck', neckGeo, [0, 0.03, 0], [1, 1, 1], 'neck', 'skin');
  const hs = female ? 0.95 : 1; // head size
  add('head', sphere, [0, 0.1, 0.005], [0.088 * hs, 0.11 * hs, 0.1 * hs], 'head', 'skin'); // skull
  add('head', sphere, [0, 0.045, 0.035], female ? [0.058, 0.05, 0.065] : [0.066, 0.056, 0.07], 'head', 'skin'); // jaw
  add('head', sphere, [0, 0.085, 0.098 * hs], [0.013, 0.021, 0.02], 'head', 'skin'); // nose: shows which way the head faces
  for (const x of [-1, 1]) add('head', sphere, [x * 0.087 * hs, 0.085, 0], [0.013, 0.025, 0.019], 'head', 'skin'); // ears
  if (female) {
    // shoulder-length hair: cap, volume at the back and sides
    add('head', sphere, [0, 0.12, -0.012], [0.096, 0.1, 0.1], 'head', 'hair');
    add('head', sphere, [0, 0.06, -0.04], [0.095, 0.105, 0.075], 'head', 'hair');
    for (const x of [-1, 1]) add('head', sphere, [x * 0.07, 0.06, -0.005], [0.035, 0.085, 0.06], 'head', 'hair');
  } else {
    add('head', sphere, [0, 0.125, -0.015], [0.094, 0.098, 0.1], 'head', 'hair');
  }

  const armScale = female ? 0.9 : 1;
  for (const p of ['l', 'r'] as const) {
    const s = p === 'l' ? 1 : -1; // +1: the figure's left is +X
    const a = armScale;
    // ── Arm: short sleeve with a hem, then skin ──
    ball(`${p}_shoulder`, 0.058 * a, 'top', `${p}_upperarm`);
    limb(`${p}_shoulder`, 0.053 * a, 0.049 * a, 0, 0.11, `${p}_upperarm`, 'top');
    ring(`${p}_shoulder`, 0.049 * a, -0.108, `${p}_upperarm`, 'top');
    limb(`${p}_shoulder`, 0.045 * a, 0.037 * a, 0.11, 0.18, `${p}_upperarm`, 'skin');
    ball(`${p}_elbow`, 0.039 * a, 'skin');
    limb(`${p}_elbow`, 0.042 * a, 0.028 * a, 0, 0.26, `${p}_forearm`, 'skin');
    // ── Hand: palm, four fingers, thumb (palm faces the body when the arm hangs) ──
    const hsz = female ? 0.92 : 1;
    add(`${p}_wrist`, sphere, [0, -0.048 * hsz, 0], [0.019, 0.05 * hsz, 0.043 * hsz], `${p}_hand`, 'skin');
    const fingers: [number, number][] = [
      [0.026, 0.044],
      [0.009, 0.05],
      [-0.009, 0.047],
      [-0.025, 0.038],
    ];
    for (const [z, len] of fingers) {
      const l = len * hsz;
      add(`${p}_wrist`, capsule(0.0085 * hsz, l - 0.017), [-0.004 * s, -0.092 * hsz - l / 2, z * hsz], [1, 1, 1], `${p}_hand`, 'skin', [0, 0, 0.12 * s]);
    }
    add(`${p}_wrist`, capsule(0.0105 * hsz, 0.03 * hsz), [-0.012 * s, -0.055 * hsz, 0.045 * hsz], [1, 1, 1], `${p}_hand`, 'skin', [-0.55, 0, 0.25 * s]);
    // ── Leg: shorts with a hem, then skin with knee cap and calf, sock and shoe ──
    ball(`${p}_hip`, 0.074, 'bottom', `${p}_thigh`);
    limb(`${p}_hip`, female ? 0.078 : 0.075, 0.07, 0, 0.2, `${p}_thigh`, 'bottom');
    ring(`${p}_hip`, 0.07, -0.198, `${p}_thigh`, 'bottom');
    limb(`${p}_hip`, female ? 0.069 : 0.067, 0.051, 0.2, 0.23, `${p}_thigh`, 'skin');
    ball(`${p}_knee`, 0.053, 'skin');
    add(`${p}_knee`, sphere, [0, 0.005, 0.042], [0.032, 0.036, 0.022], `${p}_shin`, 'skin'); // knee cap
    limb(`${p}_knee`, 0.05, 0.034, 0, 0.42, `${p}_shin`, 'skin');
    add(`${p}_knee`, sphere, [0, -0.13, -0.022], female ? [0.047, 0.1, 0.048] : [0.05, 0.1, 0.05], `${p}_shin`, 'skin'); // calf
    limb(`${p}_knee`, 0.038, 0.037, 0.37, 0.05, `${p}_shin`, 'sock');
    ball(`${p}_ankle`, 0.038, 'sock');
    add(`${p}_ankle`, sphere, [0, -0.048, 0.055], [0.048, 0.032, 0.122], `${p}_foot`, 'shoe');
    add(`${p}_ankle`, sphere, [0, -0.045, -0.02], [0.042, 0.037, 0.05], `${p}_foot`, 'shoe'); // heel
    const sole = new THREE.BoxGeometry(0.088, 0.012, 0.25);
    geos.push(sole);
    add(`${p}_ankle`, sole, [0, -0.074, 0.048], [1, 1, 1], `${p}_foot`, 'sole');
  }

  let highlighted: SegmentName[] = [];
  const hlColor = new THREE.Color(HIGHLIGHT_COLOR);

  return {
    root,
    joints,
    points,
    segments,
    bodyMeshes,
    setPose(pose) {
      for (const name of JOINT_NAMES) {
        const r = pose[name] ?? [0, 0, 0];
        joints[name].rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG);
      }
      const p = pose.pos ?? [0, 0, 0];
      joints.pelvis.position.set(p[0], p[1], p[2]);
    },
    setHighlight(segs) {
      highlighted = segs;
      for (const m of materials.values()) {
        if (m.seg && segs.includes(m.seg)) continue;
        m.mat.color.copy(m.base);
        m.mat.emissive.setRGB(0, 0, 0);
      }
    },
    tick(t) {
      if (!highlighted.length) return;
      const k = 0.5 + 0.25 * Math.sin(t * 3);
      for (const m of materials.values()) {
        if (!m.seg || !highlighted.includes(m.seg)) continue;
        m.mat.color.copy(m.base).lerp(hlColor, k);
        m.mat.emissive.copy(hlColor).multiplyScalar(0.12 * k);
      }
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      materials.forEach((m) => m.mat.dispose());
    },
  };
}

const mirrorName = <T extends string>(n: T): T =>
  (n.startsWith('l_') ? `r_${n.slice(2)}` : n.startsWith('r_') ? `l_${n.slice(2)}` : n) as T;
export { mirrorName };

/** Left/right mirror image of a pose (reflection through the YZ plane). */
export function mirrorPose(pose: Pose): Pose {
  const out: Pose = {};
  for (const name of JOINT_NAMES) {
    const r = pose[name];
    if (r) out[mirrorName(name)] = [r[0], -r[1], -r[2]];
  }
  if (pose.pos) out.pos = [-pose.pos[0], pose.pos[1], pose.pos[2]];
  return out;
}

/** Linear blend of two full poses. */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const name of JOINT_NAMES) {
    const ra = a[name] ?? [0, 0, 0];
    const rb = b[name] ?? [0, 0, 0];
    out[name] = [ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t];
  }
  const pa = a.pos ?? [0, 0, 0];
  const pb = b.pos ?? [0, 0, 0];
  out.pos = [pa[0] + (pb[0] - pa[0]) * t, 0, pa[2] + (pb[2] - pa[2]) * t];
  return out;
}
