import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

/** Reads the OS setting so the card can hold completely still. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function GiftCard({ reduced, palette }: { reduced: boolean; palette: { face: string; spark: string; detail: string } }) {
  const group = useRef<THREE.Group>(null);
  const time = useRef(0);
  const [texture, setTexture] = useState<THREE.CanvasTexture>();

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = palette.face;
    ctx.fillRect(0, 0, 1024, 640);
    // Fine diagonal engraving gives the card a tactile, satin finish.
    ctx.strokeStyle = palette.detail;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 1;
    for (let x = -640; x < 1024; x += 14) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 640, 640); ctx.stroke();
    }
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = palette.spark;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(28, 28, 968, 584, 34); ctx.stroke();
    // One small gift emblem, printed on the card rather than floating nearby.
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.strokeRect(126, 132, 114, 83);
    ctx.strokeRect(118, 115, 130, 23);
    ctx.beginPath(); ctx.moveTo(183, 115); ctx.lineTo(183, 215);
    ctx.moveTo(183, 114);
    ctx.bezierCurveTo(115, 115, 133, 56, 164, 86);
    ctx.lineTo(183, 114);
    ctx.bezierCurveTo(251, 115, 233, 56, 202, 86);
    ctx.closePath(); ctx.stroke();
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    setTexture(map);
    return () => map.dispose();
  }, [palette]);

  useFrame((_, rawDelta) => {
    if (!group.current || reduced) return;
    time.current += Math.min(rawDelta, 0.05);
    const t = time.current;
    group.current.rotation.set(0.08 + Math.sin(t * 0.32) * 0.035, -0.18 + Math.sin(t * 0.28) * 0.13, -0.08 + Math.sin(t * 0.25) * 0.025);
    group.current.position.y = 0.6 + Math.sin(t * 0.4) * 0.12;
  });

  return (
    <group ref={group} position={[0, 0.6, -0.5]} rotation={[0.08, -0.18, -0.08]} scale={0.85}>
      <RoundedBox args={[6, 3.75, 0.12]} radius={0.22} smoothness={4}>
        <meshStandardMaterial color={palette.face} metalness={0.2} roughness={0.65} />
      </RoundedBox>
      <RoundedBox args={[5.96, 3.71, 0.12]} radius={0.2} smoothness={4} position={[0, 0, 0.015]}>
        <meshStandardMaterial color={palette.face} metalness={0.35} roughness={0.58} />
      </RoundedBox>
      {texture && <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={[5.65, 3.5]} />
        <meshStandardMaterial map={texture} metalness={0.28} roughness={0.62} />
      </mesh>}
    </group>
  );
}

/** A WebGL failure must never blank the hero copy — the scene simply drops out. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function HeroSpark3D() {
  const reduced = usePrefersReducedMotion();
  const [palette, setPalette] = useState<{ face: string; spark: string; detail: string }>();
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string) => `hsl(${style.getPropertyValue(name).trim()})`;
    setPalette({ face: token("--hero-card-face"), spark: token("--secondary"), detail: token("--hero-card-detail") });
  }, []);
  if (!palette) return null;

  return (
    <SceneBoundary>
      <Canvas
        camera={{ position: [0, 0, 9], fov: 50 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.85} color={palette.detail} />
        <directionalLight position={[6, 8, 6]} intensity={1.6} color={palette.detail} />
        <pointLight position={[-6, 2, 4]} intensity={18} decay={2} color={palette.spark} />
        <GiftCard reduced={reduced} palette={palette} />
        <Environment resolution={128}>
          <Lightformer intensity={1.5} color={palette.detail} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={0.8} color={palette.spark} position={[-6, 1, -2]} rotation-y={Math.PI / 2} scale={[12, 3, 1]} />
        </Environment>
      </Canvas>
    </SceneBoundary>
  );
}
