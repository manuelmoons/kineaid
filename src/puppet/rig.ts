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

export const BODY_COLOR = 0xe8dcc8;
export const JOINT_COLOR = 0xc9b79c;
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

  const bodyMat = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.65, metalness: 0 });
  const jointMat = new THREE.MeshStandardMaterial({ color: JOINT_COLOR, roughness: 0.6, metalness: 0 });
  const geos: THREE.BufferGeometry[] = [];
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  geos.push(sphere);
  const segments = {} as Record<SegmentName, THREE.Mesh[]>;
  const bodyMeshes: THREE.Mesh[] = [];
  const segMaterial = new Map<SegmentName, THREE.MeshStandardMaterial>();

  const matFor = (seg: SegmentName | null, isJoint: boolean): THREE.MeshStandardMaterial => {
    if (!seg) return isJoint ? jointMat : bodyMat;
    let m = segMaterial.get(seg);
    if (!m) {
      m = bodyMat.clone();
      segMaterial.set(seg, m);
    }
    return m;
  };

  const add = (
    parent: JointName,
    geo: THREE.BufferGeometry,
    pos: Vec3,
    scale: Vec3,
    seg: SegmentName | null,
    isJoint = false,
  ) => {
    const mesh = new THREE.Mesh(geo, matFor(seg, isJoint));
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    joints[parent].add(mesh);
    bodyMeshes.push(mesh);
    if (seg) (segments[seg] ??= []).push(mesh);
    return mesh;
  };
  const capsule = (radius: number, length: number) => {
    const g = new THREE.CapsuleGeometry(radius, length, 6, 14);
    geos.push(g);
    return g;
  };

  // Torso
  add('pelvis', sphere, [0, -0.01, 0], [0.165, 0.11, 0.11], 'pelvis');
  add('spine', capsule(0.115, 0.06), [0, 0.08, 0], [1, 1, 0.78], 'abdomen');
  add('chest', sphere, [0, 0.15, -0.005], [0.165, 0.2, 0.115], 'chest');
  add('neck', capsule(0.045, 0.05), [0, 0.03, 0], [1, 1, 1], 'neck');
  add('head', sphere, [0, 0.1, 0.01], [0.092, 0.118, 0.105], 'head');
  // Nose: shows which way the head faces.
  add('head', sphere, [0, 0.09, 0.11], [0.018, 0.026, 0.022], 'head');

  for (const p of ['l', 'r'] as const) {
    add(`${p}_shoulder`, sphere, [0, 0, 0], [0.056, 0.056, 0.056], null, true);
    add(`${p}_shoulder`, capsule(0.046, 0.2), [0, -0.145, 0], [1, 1, 1], `${p}_upperarm`);
    add(`${p}_elbow`, sphere, [0, 0, 0], [0.041, 0.041, 0.041], null, true);
    add(`${p}_elbow`, capsule(0.038, 0.18), [0, -0.13, 0], [1, 1, 1], `${p}_forearm`);
    add(`${p}_wrist`, sphere, [0, -0.07, 0], [0.026, 0.078, 0.045], `${p}_hand`);
    add(`${p}_hip`, sphere, [0, 0, 0], [0.074, 0.074, 0.074], null, true);
    add(`${p}_hip`, capsule(0.068, 0.3), [0, -0.215, 0], [1, 1, 1], `${p}_thigh`);
    add(`${p}_knee`, sphere, [0, 0, 0], [0.054, 0.054, 0.054], null, true);
    add(`${p}_knee`, capsule(0.052, 0.32), [0, -0.21, 0], [1, 1, 1], `${p}_shin`);
    add(`${p}_ankle`, sphere, [0, 0, 0], [0.04, 0.04, 0.04], null, true);
    add(`${p}_ankle`, sphere, [0, -0.045, 0.055], [0.046, 0.035, 0.125], `${p}_foot`);
  }

  let highlighted: SegmentName[] = [];
  const hlColor = new THREE.Color(HIGHLIGHT_COLOR);
  const baseColor = new THREE.Color(BODY_COLOR);

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
      for (const [seg, m] of segMaterial) {
        if (!segs.includes(seg)) {
          m.color.copy(baseColor);
          m.emissive.setRGB(0, 0, 0);
        }
      }
    },
    tick(t) {
      const k = 0.55 + 0.25 * Math.sin(t * 3);
      for (const seg of highlighted) {
        const m = segMaterial.get(seg);
        if (!m) continue;
        m.color.copy(baseColor).lerp(hlColor, k);
        m.emissive.copy(hlColor).multiplyScalar(0.12 * k);
      }
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      bodyMat.dispose();
      jointMat.dispose();
      segMaterial.forEach((m) => m.dispose());
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
