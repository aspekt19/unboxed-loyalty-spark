import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Palette = { face: string; spark: string; detail: string };

/** Decorative balance only: never connected to customer rewards or pricing. */
export function LoyaltyCardFace({ palette, reduced }: { palette: Palette; reduced: boolean }) {
  const surface = useRef<{ canvas: HTMLCanvasElement; base: HTMLCanvasElement; map: THREE.CanvasTexture }>();
  const time = useRef(0);
  const lastPaint = useRef(-1);
  const [map, setMap] = useState<THREE.CanvasTexture>();

  useEffect(() => {
    const base = document.createElement("canvas");
    base.width = 1024;
    base.height = 640;
    const ctx = base.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = palette.face;
    ctx.fillRect(0, 0, 1024, 640);
    ctx.strokeStyle = palette.detail;
    ctx.globalAlpha = 0.07;
    for (let x = -640; x < 1024; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 640, 640); ctx.stroke();
    }
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = palette.spark;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(24, 24, 976, 592, 32); ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = palette.detail;
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.fillText("LOYAL SPARK", 74, 82);
    ctx.globalAlpha = 0.55;
    ctx.font = '500 19px system-ui, sans-serif';
    ctx.fillText("POINTS BALANCE", 74, 132);
    ctx.fillText("MEMBER REWARDS", 74, 561);
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.moveTo(74, 505); ctx.lineTo(950, 505); ctx.stroke();
    // Embossed contactless mark, printed on the same card.
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = palette.detail;
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(874, 76, 13 + i * 12, -0.7, 0.7); ctx.stroke();
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 640;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    surface.current = { canvas, base, map: texture };
    lastPaint.current = -1;
    setMap(texture);
    return () => { surface.current = undefined; texture.dispose(); };
  }, [palette]);

  useFrame((_, rawDelta) => {
    const current = surface.current;
    if (!current) return;
    if (!reduced) time.current += Math.min(rawDelta, 0.05);
    const tick = reduced ? 0 : Math.floor(time.current * 20);
    if (tick === lastPaint.current) return;
    lastPaint.current = tick;
    const ctx = current.canvas.getContext("2d");
    if (!ctx) return;
    const phase = reduced ? 5 : time.current % 9;
    const progress = THREE.MathUtils.smoothstep(phase, 1.5, 4.5);
    const fade = 1 - THREE.MathUtils.smoothstep(phase, 7.7, 8.8);
    ctx.globalAlpha = 1;
    ctx.drawImage(current.base, 0, 0);
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = palette.detail;
    ctx.font = '600 84px system-ui, sans-serif';
    ctx.fillText(Math.round(1200 + progress * 150).toLocaleString("en-US"), 70, 220);
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.globalAlpha = 0.6;
    ctx.fillText("PTS", 314, 216);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = palette.detail;
    ctx.beginPath(); ctx.roundRect(74, 252, 440, 5, 2); ctx.fill();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = palette.spark;
    ctx.beginPath(); ctx.roundRect(74, 252, 310 + progress * 130, 5, 2); ctx.fill();
    const notice = THREE.MathUtils.smoothstep(phase, 1, 1.8) * fade;
    ctx.globalAlpha = notice * 0.85;
    ctx.fillStyle = palette.spark;
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.fillText(progress < 1 ? "+150 points" : "✓  Points added", 560, 202 - progress * 6);
    if (!reduced && phase > 1 && phase < 5) {
      const x = -400 + (phase - 1) * 430;
      ctx.save();
      ctx.beginPath(); ctx.roundRect(28, 28, 968, 584, 30); ctx.clip();
      ctx.translate(x, 0); ctx.transform(1, 0, -0.45, 1, 0, 0);
      const sheen = ctx.createLinearGradient(0, 0, 240, 0);
      sheen.addColorStop(0, palette.detail); sheen.addColorStop(0.5, palette.detail); sheen.addColorStop(1, palette.detail);
      ctx.fillStyle = sheen;
      // Thin bands feather the reflection without obscuring lettering.
      for (let i = 0; i < 24; i++) {
        ctx.globalAlpha = Math.sin(i / 24 * Math.PI) * 0.035;
        ctx.fillRect(i * 10, 0, 10, 640);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    current.map.needsUpdate = true;
  });

  return map ? (
    <mesh position={[0, 0, 0.081]}>
      <planeGeometry args={[5.65, 3.5]} />
      <meshStandardMaterial map={map} metalness={0.28} roughness={0.62} />
    </mesh>
  ) : null;
}