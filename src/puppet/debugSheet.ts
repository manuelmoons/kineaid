// DEV-only helper: draws chosen keyframes of exercises into a contact sheet overlay (for checking poses).
import type { PuppetScene } from './scene';
import { PUPPET_EXERCISES } from './exercises';

export function installDebugSheet() {
  const w = window as unknown as { __puppet?: PuppetScene; __sheet: unknown };
  w.__sheet = (items: [string, number, ('left' | 'right')?][]) => {
    const P = w.__puppet!;
    const src = document.querySelector('canvas')!;
    const cols = items.length === 1 ? 1 : 2, W = 800 / cols, H = 450 / cols;
    let out = document.getElementById('__sheet') as HTMLCanvasElement | null;
    if (!out) {
      out = document.createElement('canvas');
      out.id = '__sheet';
      Object.assign(out.style, { position: 'fixed', left: '0', top: '0', zIndex: '9999', background: '#fff' });
      out.onclick = () => out!.remove();
      document.body.appendChild(out);
    }
    out.width = W * cols;
    out.height = H * Math.ceil(items.length / cols);
    out.style.width = `${out.width}px`;
    out.style.height = `${out.height}px`;
    const g = out.getContext('2d')!;
    items.forEach(([id, f, side], k) => {
      P.setExercise(PUPPET_EXERCISES[id], side ?? 'left');
      P.showFrame(f);
      const x = (k % cols) * W, y = Math.floor(k / cols) * H;
      g.drawImage(src, x, y, W, H);
      g.fillStyle = '#000';
      g.font = '14px sans-serif';
      g.fillText(`${id} #${f}${side ? ' ' + side : ''}`, x + 4, y + 16);
    });
  };
}
