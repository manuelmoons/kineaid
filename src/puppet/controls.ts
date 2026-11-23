import type { JointName } from './rig';

/**
 * Editor sliders per joint, in anatomical terms. A slider value v is stored as
 * rotation[axis] = v * sign, where sign follows the angle conventions in rig.ts
 * (and is flipped for the Y and Z axes of right-side joints, the mirror image).
 */
export interface AxisControl {
  axis: 0 | 1 | 2;
  /** i18n key under puppetEditor.axes */
  label: string;
  min: number;
  max: number;
  /** Sign for the LEFT side (or a centre joint). */
  sign: 1 | -1;
}

type Kind = 'pelvis' | 'trunk' | 'neck' | 'clav' | 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle';

const CONTROLS: Record<Kind, AxisControl[]> = {
  pelvis: [
    { axis: 0, label: 'bodyTilt', min: -180, max: 180, sign: 1 },
    { axis: 2, label: 'bodyRoll', min: -180, max: 180, sign: 1 },
    { axis: 1, label: 'bodyTurn', min: -180, max: 180, sign: 1 },
  ],
  trunk: [
    { axis: 0, label: 'bendForward', min: -40, max: 70, sign: 1 },
    { axis: 2, label: 'bendSide', min: -40, max: 40, sign: 1 },
    { axis: 1, label: 'twist', min: -45, max: 45, sign: 1 },
  ],
  neck: [
    { axis: 0, label: 'nod', min: -50, max: 60, sign: 1 },
    { axis: 2, label: 'tiltSide', min: -45, max: 45, sign: 1 },
    { axis: 1, label: 'turnHead', min: -70, max: 70, sign: 1 },
  ],
  clav: [
    { axis: 1, label: 'shoulderBack', min: -20, max: 30, sign: 1 },
    { axis: 2, label: 'shoulderUp', min: -10, max: 30, sign: 1 },
  ],
  shoulder: [
    { axis: 0, label: 'armForward', min: -60, max: 180, sign: -1 },
    { axis: 2, label: 'armSideways', min: -30, max: 180, sign: 1 },
    { axis: 1, label: 'armRotate', min: -90, max: 90, sign: 1 },
  ],
  elbow: [{ axis: 0, label: 'elbowBend', min: 0, max: 150, sign: -1 }],
  wrist: [{ axis: 0, label: 'wristBend', min: -90, max: 90, sign: 1 }],
  hip: [
    { axis: 0, label: 'hipBend', min: -30, max: 130, sign: -1 },
    { axis: 2, label: 'legSideways', min: -30, max: 60, sign: 1 },
    { axis: 1, label: 'legRotate', min: -60, max: 60, sign: 1 },
  ],
  knee: [{ axis: 0, label: 'kneeBend', min: 0, max: 150, sign: 1 }],
  ankle: [
    { axis: 0, label: 'footPoint', min: -30, max: 60, sign: 1 },
    { axis: 1, label: 'footTurn', min: -30, max: 30, sign: 1 },
  ],
};

const KIND: Record<JointName, Kind> = {
  pelvis: 'pelvis',
  spine: 'trunk',
  chest: 'trunk',
  neck: 'neck',
  head: 'neck',
  l_clav: 'clav',
  r_clav: 'clav',
  l_shoulder: 'shoulder',
  r_shoulder: 'shoulder',
  l_elbow: 'elbow',
  r_elbow: 'elbow',
  l_wrist: 'wrist',
  r_wrist: 'wrist',
  l_hip: 'hip',
  r_hip: 'hip',
  l_knee: 'knee',
  r_knee: 'knee',
  l_ankle: 'ankle',
  r_ankle: 'ankle',
};

/** Sliders for a joint, with the sign already adjusted for its side. */
export function controlsFor(joint: JointName): AxisControl[] {
  const right = joint.startsWith('r_');
  return CONTROLS[KIND[joint]].map((c) => ({ ...c, sign: (right && c.axis !== 0 ? -c.sign : c.sign) as 1 | -1 }));
}

/** Joints in the order the editor lists them. */
export const JOINT_GROUPS: { label: string; joints: JointName[] }[] = [
  { label: 'trunk', joints: ['pelvis', 'spine', 'chest', 'neck', 'head'] },
  { label: 'leftArm', joints: ['l_clav', 'l_shoulder', 'l_elbow', 'l_wrist'] },
  { label: 'rightArm', joints: ['r_clav', 'r_shoulder', 'r_elbow', 'r_wrist'] },
  { label: 'leftLeg', joints: ['l_hip', 'l_knee', 'l_ankle'] },
  { label: 'rightLeg', joints: ['r_hip', 'r_knee', 'r_ankle'] },
];
