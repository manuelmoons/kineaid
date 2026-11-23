import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createRig, lerpPose, mirrorName, mirrorPose, type PointName, type Pose, type Rig, type SegmentName, type Vec3 } from './rig';
import { BASES, type Prop, type PropPlacement, type PuppetExercise } from './exercises';

type Side = 'left' | 'right';

interface PreparedSide {
  side: Side;
  frames: Pose[];
  /** Timeline: hold frame i, then move to frame i+1. */
  segments: { from: number; to: number; dur: number }[];
  total: number;
  anchor: PointName[];
  anchorRef: THREE.Vector3;
  floorY: number;
  props: THREE.Group;
  straps: { mesh: THREE.Mesh; from: PointName; to: PointName }[];
  highlight: SegmentName[];
}

const FLOOR_COLOR = 0xe6ecf1;
const PROP_COLOR = 0xb08d6a;
const WALL_COLOR = 0xdbe2e8;
const MAT_COLOR = 0x5eead4;

const smooth = (t: number) => t * t * (3 - 2 * t);

/** A self-contained three.js scene that plays one puppet exercise in a container element. */
export class PuppetScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
  private controls: OrbitControls;
  private rig: Rig;
  private sides: PreparedSide[] = [];
  private ease: (t: number) => number = smooth;
  private raf = 0;
  private start = performance.now();
  private resizeObs: ResizeObserver;
  private disposables: { dispose(): void }[] = [];
  private homeCam = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private currentSide: Side | null = null;
  onSideChange?: (side: Side | null) => void;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0xf1f5f9);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xaab6c2, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(2.5, 5, 3.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 15 });
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 4;
    this.scene.add(sun);

    const floorGeo = new THREE.CircleGeometry(6, 48);
    const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.scene.fog = new THREE.Fog(0xf1f5f9, 5, 11);
    this.disposables.push(floorGeo, floorMat);

    this.rig = createRig();
    this.scene.add(this.rig.root);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 7;

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
  }

  setExercise(ex: PuppetExercise, side: Side | null) {
    for (const s of this.sides) {
      this.scene.remove(s.props);
      disposeTree(s.props);
    }
    const list: Side[] = side ? [side] : ex.sides === 'alternate' ? ['left', 'right'] : ['left'];
    this.ease = ex.ease === 'linear' ? (t) => t : smooth;
    this.sides = list.map((s) => this.prepare(ex, s));
    this.sides.forEach((s) => this.scene.add(s.props));
    this.currentSide = null;
    this.frameCamera(ex, side === 'right');
    this.start = performance.now();
  }

  resetView() {
    this.camera.position.copy(this.homeCam.pos);
    this.controls.target.copy(this.homeCam.target);
    this.controls.update();
  }

  play() {
    if (this.raf) return;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.render((performance.now() - this.start) / 1000);
    };
    loop();
  }

  /** Show keyframe i (of the given side index) without animating; for debugging/screenshots. */
  showFrame(i: number, sideIndex = 0) {
    this.stop();
    const s = this.sides[sideIndex];
    let t = sideIndex * s.total;
    for (const seg of s.segments) {
      if (seg.from === i && seg.to === i) break;
      t += seg.dur;
    }
    this.render(t + 0.001);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose() {
    this.stop();
    this.resizeObs.disconnect();
    this.controls.dispose();
    for (const s of this.sides) disposeTree(s.props);
    this.rig.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ─── internals ─────────────────────────────────────────────

  private resize() {
    const w = this.container.clientWidth || 300;
    const h = this.container.clientHeight || 200;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private prepare(ex: PuppetExercise, side: Side): PreparedSide {
    const mirror = side === 'right';
    const m = <T extends string>(n: T) => (mirror ? mirrorName(n) : n);
    const base = BASES[ex.base];
    const frames = ex.keyframes.map((k) => {
      const pose = { ...base, ...k.pose };
      return mirror ? mirrorPose(pose) : pose;
    });
    const n = frames.length;
    const segments: PreparedSide['segments'] = [];
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      segments.push({ from: i, to: i, dur: ex.keyframes[i].hold ?? 0 });
      if (n > 1) segments.push({ from: i, to: next, dur: ex.keyframes[next].move ?? 1 });
    }
    const total = Math.max(0.001, segments.reduce((a, s) => a + s.dur, 0));
    const hasMat = ex.props?.some((p) => p.type === 'mat') ?? false;
    const prepared: PreparedSide = {
      side,
      frames,
      segments,
      total,
      anchor: (ex.anchor ?? ['pelvis']).map(m),
      anchorRef: new THREE.Vector3(),
      floorY: hasMat ? 0.012 : 0,
      props: new THREE.Group(),
      straps: [],
      highlight: (ex.highlight ?? []).map(m),
    };
    // Reference position of the anchor: frame 0 with the pelvis at the origin.
    this.applyPose(prepared, frames[0], false);
    prepared.anchorRef.copy(this.anchorPos(prepared.anchor));
    prepared.anchorRef.y = 0;

    for (const prop of ex.props ?? []) {
      const p = mirror ? mirrorProp(prop) : prop;
      if (p.type === 'strap') {
        const mesh = strapMesh(p.color ?? 0x60a5fa);
        prepared.props.add(mesh);
        prepared.straps.push({ mesh, from: p.from, to: p.to });
      } else if (p.type === 'mat') {
        prepared.props.add(this.buildMat(prepared));
      } else {
        const pos = this.placementPos(prepared, p);
        prepared.props.add(buildProp(p, pos));
      }
    }
    return prepared;
  }

  /** Pose the rig, put its lowest point on the floor and keep the anchor in place. */
  private applyPose(s: PreparedSide, pose: Pose, anchored = true) {
    this.rig.setPose(pose);
    const pelvis = this.rig.joints.pelvis;
    this.rig.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const mesh of this.rig.bodyMeshes) box.expandByObject(mesh, true);
    pelvis.position.y += s.floorY - box.min.y;
    if (anchored) {
      this.rig.root.updateMatrixWorld(true);
      const a = this.anchorPos(s.anchor);
      pelvis.position.x += s.anchorRef.x - a.x;
      pelvis.position.z += s.anchorRef.z - a.z;
    }
    this.rig.root.updateMatrixWorld(true);
  }

  private anchorPos(points: PointName[]): THREE.Vector3 {
    const v = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    for (const p of points) v.add(this.rig.points[p].getWorldPosition(tmp));
    return v.divideScalar(points.length);
  }

  private placementPos(s: PreparedSide, p: PropPlacement): THREE.Vector3 {
    const pos = new THREE.Vector3();
    if (p.at) {
      this.applyPose(s, s.frames[p.frame ?? 0]);
      pos.copy(this.anchorPos(Array.isArray(p.at) ? p.at : [p.at]));
    }
    if (p.offset) pos.add(new THREE.Vector3(...p.offset));
    return pos;
  }

  private buildMat(s: PreparedSide): THREE.Object3D {
    this.applyPose(s, s.frames[0]);
    const box = new THREE.Box3();
    for (const mesh of this.rig.bodyMeshes) box.expandByObject(mesh, true);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const alongZ = size.z >= size.x;
    const len = Math.max(size.z, size.x) + 0.3;
    const geo = new THREE.BoxGeometry(alongZ ? 0.7 : len, 0.012, alongZ ? len : 0.7);
    const mat = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: MAT_COLOR, roughness: 0.9 }));
    mat.position.set(c.x, 0.006, c.z);
    mat.receiveShadow = true;
    return mat;
  }

  private frameCamera(ex: PuppetExercise, mirrored: boolean) {
    // Bounding box over all frames of the first side.
    const s = this.sides[0];
    const box = new THREE.Box3();
    for (const f of s.frames) {
      this.applyPose(s, f);
      for (const mesh of this.rig.bodyMeshes) box.expandByObject(mesh, false);
    }
    const target = box.getCenter(new THREE.Vector3());
    if (ex.view?.focus) {
      this.applyPose(s, s.frames[0]);
      target.copy(this.anchorPos([ex.view.focus]));
    }
    const az = ((mirrored ? -1 : 1) * (ex.view?.az ?? 90) * Math.PI) / 180;
    const el = ((ex.view?.el ?? 12) * Math.PI) / 180;
    const back = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    // Smallest distance at which every corner of the box fits in the view (with a margin).
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), back).normalize();
    const up = new THREE.Vector3().crossVectors(back, right);
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360) * 0.85;
    const tanH = tanV * this.camera.aspect;
    let dist = 1.2;
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(target);
      const depth = c.dot(back);
      dist = Math.max(dist, depth + Math.abs(c.dot(right)) / tanH, depth + Math.abs(c.dot(up)) / tanV);
    }
    if (ex.view?.dist) dist = ex.view.dist;
    this.homeCam.target.copy(target);
    this.homeCam.pos.copy(target).addScaledVector(back, dist);
    this.resetView();
  }

  private render(time: number) {
    if (!this.sides.length) return;
    const cycle = Math.floor(time / this.sides[0].total);
    const s = this.sides[cycle % this.sides.length];
    if (this.sides.length > 1 && s.side !== this.currentSide) {
      this.currentSide = s.side;
      this.sides.forEach((x) => (x.props.visible = x === s));
      this.rig.setHighlight(s.highlight);
      this.onSideChange?.(s.side);
    } else if (this.currentSide === null) {
      this.currentSide = s.side;
      this.rig.setHighlight(s.highlight);
      this.onSideChange?.(this.sides.length > 1 ? s.side : null);
    }

    let t = time - cycle * s.total;
    let pose = s.frames[0];
    for (const seg of s.segments) {
      if (t <= seg.dur || seg === s.segments[s.segments.length - 1]) {
        const k = seg.dur > 0 ? Math.min(1, t / seg.dur) : 1;
        pose = seg.from === seg.to ? s.frames[seg.from] : lerpPose(s.frames[seg.from], s.frames[seg.to], this.ease(k));
        break;
      }
      t -= seg.dur;
    }
    this.applyPose(s, pose);
    for (const st of s.straps) {
      updateStrap(st.mesh, this.rig.points[st.from].getWorldPosition(new THREE.Vector3()), this.rig.points[st.to].getWorldPosition(new THREE.Vector3()));
    }
    this.rig.tick(time);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// ─── props ───────────────────────────────────────────────────

function mirrorProp(p: Prop): Prop {
  if (p.type === 'mat') return p;
  if (p.type === 'strap') return { ...p, from: mirrorName(p.from), to: mirrorName(p.to) };
  const at = p.at === undefined ? undefined : Array.isArray(p.at) ? p.at.map(mirrorName) : mirrorName(p.at);
  const offset: Vec3 | undefined = p.offset ? [-p.offset[0], p.offset[1], p.offset[2]] : undefined;
  return { ...p, at, offset, rotY: p.rotY === undefined ? undefined : -p.rotY };
}

function material(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function buildProp(p: Exclude<Prop, { type: 'mat' } | { type: 'strap' }>, pos: THREE.Vector3): THREE.Object3D {
  const g = new THREE.Group();
  const rot = ((p.rotY ?? 0) * Math.PI) / 180;
  g.rotation.y = rot;
  if (p.type === 'chair') {
    const mat = material(PROP_COLOR);
    const depth = 0.42;
    const seatH = p.ref === 'seat' ? pos.y : 0.46;
    const backTop = p.ref === 'back' ? pos.y : seatH + 0.42;
    const t = 0.035;
    g.add(box(0.44, t, depth, 0, seatH - t / 2, 0, mat));
    for (const x of [-0.19, 0.19]) {
      for (const z of [-0.18, 0.18]) g.add(box(0.035, seatH - t, 0.035, x, (seatH - t) / 2, z, mat));
      g.add(box(0.035, backTop - seatH, 0.035, x, seatH + (backTop - seatH) / 2, -depth / 2 + 0.02, mat));
    }
    g.add(box(0.44, 0.14, 0.025, 0, backTop - 0.08, -depth / 2 + 0.02, mat));
    // Origin = floor under the seat centre; for 'back', shift so the backrest top sits at the point.
    const local = p.ref === 'back' ? new THREE.Vector3(0, 0, -depth / 2 + 0.02) : new THREE.Vector3();
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    g.position.set(pos.x - local.x, 0, pos.z - local.z);
  } else if (p.type === 'wall') {
    g.add(box(2.6, 2.3, 0.1, 0, 1.15, -0.05, material(WALL_COLOR)));
    g.position.set(pos.x, 0, pos.z);
  } else if (p.type === 'table') {
    const mat = material(PROP_COLOR);
    const h = pos.y;
    g.add(box(0.9, 0.035, 0.6, 0, h - 0.0175, 0, mat));
    for (const x of [-0.4, 0.4]) for (const z of [-0.25, 0.25]) g.add(box(0.04, h - 0.035, 0.04, x, (h - 0.035) / 2, z, mat));
    g.position.set(pos.x, 0, pos.z);
  } else if (p.type === 'roll') {
    const r = 0.045;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 20), material(0x93c5fd));
    m.rotation.z = Math.PI / 2;
    m.position.y = r;
    m.castShadow = true;
    g.add(m);
    g.position.set(pos.x, 0, pos.z);
  }
  return g;
}

function strapMesh(color: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8), material(color));
  m.castShadow = true;
  return m;
}

const UP = new THREE.Vector3(0, 1, 0);
function updateStrap(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.scale.set(1, Math.max(len, 0.001), 1);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
}

function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
    }
  });
}
