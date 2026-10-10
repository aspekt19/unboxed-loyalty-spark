import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, RoundedBox } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import { CanvasTexture, Group, Shape, SRGBColorSpace } from 'three';

type Palette = { primary: string; secondary: string; silver: string; ink: string };

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => `hsl(${css.getPropertyValue(name).trim().split(/\s+/).join(', ')})`;
  return { primary: token('--primary'), secondary: token('--secondary'), silver: token('--scene-silver'), ink: token('--foreground') };
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function Sculpture({ palette, reduced }: { palette: Palette; reduced: boolean }) {
  const spark = useRef<Group>(null);
  const tokens = useRef<Group>(null);
  const elapsed = useRef(0);
  const { viewport } = useThree();
  const compact = viewport.width < 8;
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(0.2, 1.6); s.lineTo(-1.05, -0.15); s.lineTo(-0.08, -0.15);
    s.lineTo(-0.3, -1.6); s.lineTo(1.05, 0.35); s.lineTo(0.15, 0.35); s.closePath();
    return s;
  }, []);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = palette.silver; ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = palette.primary; ctx.lineWidth = 2;
      for (let i = -256; i < 512; i += 24) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 256, 256); ctx.stroke();
      }
      ctx.fillStyle = palette.ink; ctx.font = 'bold 96px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('LS', 128, 162);
    }
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace;
    return map;
  }, [palette]);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(({ pointer }, rawDelta) => {
    if (reduced) return;
    elapsed.current += Math.min(rawDelta, 0.05);
    const t = elapsed.current;
    const blend = 1 - Math.exp(-3 * Math.min(rawDelta, 0.05));
    if (spark.current) {
      spark.current.rotation.y += (0.3 + Math.sin(t * 0.45) * 0.22 + pointer.x * 0.18 - spark.current.rotation.y) * blend;
      spark.current.rotation.z = Math.sin(t * 0.55) * 0.07 - 0.12;
      spark.current.position.y = (compact ? -2.25 : -0.25) + Math.sin(t * 0.8) * 0.12;
    }
    if (tokens.current) {
      tokens.current.rotation.y = Math.sin(t * 0.35) * 0.18;
      tokens.current.rotation.z = Math.sin(t * 0.5) * 0.05 + 0.12;
    }
  });
  return <>
    <ambientLight intensity={0.8} />
    <directionalLight position={[3, 6, 8]} intensity={3} />
    <Environment resolution={128}>
      <Lightformer intensity={3} position={[0, 5, 3]} scale={[10, 6, 1]} />
      <Lightformer intensity={2} color={palette.silver} position={[-5, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
      <Lightformer intensity={2} color={palette.secondary} position={[5, -2, 1]} rotation-y={-Math.PI / 2} scale={[4, 6, 1]} />
    </Environment>
    <group ref={spark} position={[compact ? 1.05 : 4.5, compact ? -2.25 : -0.25, 0]} rotation={[0.1, 0.3, -0.12]} scale={compact ? 0.6 : 0.95}>
      <mesh position-z={-0.18}>
        <extrudeGeometry args={[shape, { depth: 0.34, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.12, bevelThickness: 0.12 }]} />
        <meshStandardMaterial color={palette.primary} metalness={0.65} roughness={0.24} />
      </mesh>
      <mesh rotation={[0.5, 0.45, 0]} position-z={-0.5}>
        <torusGeometry args={[1.85, 0.06, 12, 80]} />
        <meshStandardMaterial color={palette.silver} metalness={0.95} roughness={0.2} />
      </mesh>
    </group>
    <group ref={tokens} position={[compact ? -1.05 : -4.6, compact ? -2.35 : -0.6, 0]} rotation={[0.15, -0.25, 0.12]} scale={compact ? 0.52 : 0.85}>
      {[0, 1, 2].map(i => <group key={i} position={[i * 0.18, i * 0.28, -i * 0.3]} rotation-z={-i * 0.13}>
        <RoundedBox args={[2.5, 1.65, 0.15]} radius={0.12} smoothness={4}>
          <meshStandardMaterial color={i === 0 ? palette.secondary : palette.primary} roughness={0.3} metalness={0.5} />
        </RoundedBox>
        <mesh position-z={0.081}>
          <planeGeometry args={[2.24, 1.4]} />
          <meshStandardMaterial map={texture} roughness={0.4} metalness={0.25} />
        </mesh>
      </group>)}
    </group>
  </>;
}

export default function LoyaltyScene() {
  const reduced = useReducedMotion();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [visible, setVisible] = useState(true);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPalette(readPalette());
    const observer = new MutationObserver(() => setPalette(readPalette()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const visibility = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (container.current) visibility.observe(container.current);
    return () => { observer.disconnect(); visibility.disconnect(); };
  }, []);
  return <div ref={container} className="loyalty-scene" aria-hidden="true">
    {palette && <SceneBoundary><Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 11], fov: 45 }} frameloop={reduced || !visible ? 'demand' : 'always'} gl={{ alpha: true, antialias: true }}>
      <Suspense fallback={null}><Sculpture palette={palette} reduced={Boolean(reduced)} /></Suspense>
    </Canvas></SceneBoundary>}
  </div>;
}