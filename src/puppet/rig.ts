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

/** Colours of the figure: skin, clothes (T-shirt, shorts, shoes) and hair. */
export const COLORS = {
  skin: 0xdcae8c,
  shirt: 0x4f7ca8,
  shorts: 0x334155,
  shoe: 0xf1f5f9,
  sole: 0x94a3b8,
  hair: 0x4b3621,
} as const;
type ColorKind = keyof typeof COLORS;
export const HIGHLIGHT_COLOR = 0x14b8a6;

export function createRig(): Rig {
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
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  geos.push(sphere);
  const segments = {} as Record<SegmentName, THREE.Mesh[]>;
  const bodyMeshes: THREE.Mesh[] = [];
  // One material per (segment, colour), so a highlighted segment can glow while keeping its own base colour.
  const materials = new Map<string, { mat: THREE.MeshStandardMaterial; seg: SegmentName | null; base: THREE.Color }>();
  const matFor = (seg: SegmentName | null, kind: ColorKind) => {
    const key = `${seg ?? '-'}|${kind}`;
    let m = materials.get(key);
    if (!m) {
      const base = new THREE.Color(COLORS[kind]);
      const rough = kind === 'shoe' || kind === 'sole' ? 0.5 : kind === 'hair' ? 0.9 : 0.7;
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
    const g = new THREE.CapsuleGeometry(radius, length, 6, 16);
    geos.push(g);
    return g;
  };
  /** Tapered limb piece hanging down from its joint, from y = -top to y = -top - length. */
  const limb = (parent: JointName, rTop: number, rBottom: number, top: number, length: number, seg: SegmentName, kind: ColorKind) => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, length, 18, 1);
    geos.push(g);
    add(parent, g, [0, -top - length / 2, 0], [1, 1, 1], seg, kind);
  };
  const ball = (parent: JointName, r: number, kind: ColorKind, seg: SegmentName | null = null) => add(parent, sphere, [0, 0, 0], [r, r, r], seg, kind);

  // ── Trunk ──
  add('pelvis', sphere, [0, -0.01, 0], [0.165, 0.115, 0.115], 'pelvis', 'shorts');
  for (const x of [-0.068, 0.068]) add('pelvis', sphere, [x, -0.045, -0.045], [0.085, 0.09, 0.08], 'pelvis', 'shorts'); // buttocks
  add('spine', capsule(0.11, 0.07), [0, 0.08, 0], [1, 1, 0.78], 'abdomen', 'shirt');
  add('chest', sphere, [0, 0.14, -0.005], [0.16, 0.2, 0.115], 'chest', 'shirt');
  add('chest', sphere, [0, 0.235, -0.012], [0.19, 0.075, 0.1], 'chest', 'shirt'); // shoulder line
  // ── Neck & head ──
  const neckGeo = new THREE.CylinderGeometry(0.044, 0.05, 0.1, 16);
  geos.push(neckGeo);
  add('neck', neckGeo, [0, 0.03, 0], [1, 1, 1], 'neck', 'skin');
  add('head', sphere, [0, 0.1, 0.005], [0.088, 0.11, 0.1], 'head', 'skin'); // skull
  add('head', sphere, [0, 0.045, 0.035], [0.066, 0.055, 0.07], 'head', 'skin'); // jaw
  add('head', sphere, [0, 0.085, 0.1], [0.014, 0.022, 0.02], 'head', 'skin'); // nose: shows which way the head faces
  for (const x of [-0.087, 0.087]) add('head', sphere, [x, 0.085, 0], [0.014, 0.026, 0.02], 'head', 'skin'); // ears
  add('head', sphere, [0, 0.125, -0.015], [0.094, 0.098, 0.1], 'head', 'hair');

  for (const p of ['l', 'r'] as const) {
    const s = p === 'l' ? 1 : -1; // +1: the figure's left is +X
    // ── Arm: short sleeve, then skin ──
    ball(`${p}_shoulder`, 0.058, 'shirt', `${p}_upperarm`);
    limb(`${p}_shoulder`, 0.053, 0.048, 0, 0.11, `${p}_upperarm`, 'shirt');
    limb(`${p}_shoulder`, 0.045, 0.037, 0.11, 0.18, `${p}_upperarm`, 'skin');
    ball(`${p}_elbow`, 0.039, 'skin');
    limb(`${p}_elbow`, 0.041, 0.029, 0, 0.26, `${p}_forearm`, 'skin');
    // ── Hand: palm, four fingers, thumb (palm faces the body when the arm hangs) ──
    add(`${p}_wrist`, sphere, [0, -0.048, 0], [0.019, 0.05, 0.043], `${p}_hand`, 'skin');
    const fingers: [number, number][] = [
      [0.026, 0.044],
      [0.009, 0.05],
      [-0.009, 0.047],
      [-0.025, 0.038],
    ];
    for (const [z, len] of fingers) {
      add(`${p}_wrist`, capsule(0.0085, len - 0.017), [-0.004 * s, -0.092 - len / 2, z], [1, 1, 1], `${p}_hand`, 'skin', [0, 0, 0.12 * s]);
    }
    add(`${p}_wrist`, capsule(0.0105, 0.03), [-0.012 * s, -0.055, 0.045], [1, 1, 1], `${p}_hand`, 'skin', [-0.55, 0, 0.25 * s]);
    // ── Leg: shorts, then skin with a calf, shoe ──
    ball(`${p}_hip`, 0.074, 'shorts', `${p}_thigh`);
    limb(`${p}_hip`, 0.075, 0.07, 0, 0.2, `${p}_thigh`, 'shorts');
    limb(`${p}_hip`, 0.067, 0.051, 0.2, 0.23, `${p}_thigh`, 'skin');
    ball(`${p}_knee`, 0.053, 'skin');
    limb(`${p}_knee`, 0.05, 0.034, 0, 0.42, `${p}_shin`, 'skin');
    add(`${p}_knee`, sphere, [0, -0.13, -0.022], [0.05, 0.1, 0.05], `${p}_shin`, 'skin'); // calf
    ball(`${p}_ankle`, 0.038, 'skin');
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
