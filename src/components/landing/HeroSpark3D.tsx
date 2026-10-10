import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { LoyaltyCardFace } from "./LoyaltyCardFace";

/** Original card geometry and scale, independent of its resting position. */
const CARD_W = 6;
const CARD_H = 3.75;
const CARD_Z = -0.5;
const CAMERA_Z = 9;
const CAMERA_FOV = 50;
const CARD_SCALE = 0.85;






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
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);

  // Keep the full-size card behind the copy, with its emblem above the words.
  // Phones retain the original composition with only a small off-centre nudge.
  const anchor = useMemo(() => {
    const fov = (camera as THREE.PerspectiveCamera).fov || CAMERA_FOV;
    const viewH = 2 * (CAMERA_Z - CARD_Z) * Math.tan((fov * Math.PI) / 360);
    const viewW = viewH * (size.width / Math.max(size.height, 1));
    const mobile = size.width < 640;
    return {
      scale: CARD_SCALE,
      x: mobile ? 0.15 : Math.min(viewW * 0.3, viewW / 2 - CARD_W * CARD_SCALE / 2 - 0.15),
      y: mobile ? 0.75 : 1.95,
    };
  }, [camera, size]);



  useFrame((_, rawDelta) => {
    if (!group.current || reduced) return;
    time.current += Math.min(rawDelta, 0.05);
    const t = time.current;
    group.current.rotation.set(0.08 + Math.sin(t * 0.32) * 0.035, -0.18 + Math.sin(t * 0.28) * 0.13, -0.08 + Math.sin(t * 0.25) * 0.025);
    group.current.position.set(anchor.x, anchor.y + Math.sin(t * 0.4) * 0.07, CARD_Z);

  });

  return (
    <group ref={group} position={[anchor.x, anchor.y, CARD_Z]} rotation={[0.08, -0.18, -0.08]} scale={anchor.scale}>
      <RoundedBox args={[CARD_W, CARD_H, 0.1]} radius={0.12} smoothness={4}>
        <meshStandardMaterial color={palette.face} metalness={0.2} roughness={0.65} />
      </RoundedBox>
      <LoyaltyCardFace palette={palette} reduced={reduced} />

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
  // Phones skip the 3D scene entirely: the card crowds the narrow hero copy.
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  const [palette, setPalette] = useState<{ face: string; spark: string; detail: string }>();
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = (event: MediaQueryListEvent) => setMobile(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string) => `hsl(${style.getPropertyValue(name).trim()})`;
    setPalette({ face: token("--hero-card-face"), spark: token("--secondary"), detail: token("--hero-card-detail") });
  }, []);
  if (mobile || !palette) return null;

  return (
    <SceneBoundary>
      <Canvas
        camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.85} color={palette.detail} />
        <directionalLight position={[6, 8, 6]} intensity={1.6} color={palette.detail} />
        <pointLight position={[6, 3, 4]} intensity={18} decay={2} color={palette.spark} />
        <GiftCard reduced={reduced} palette={palette} />
        <Environment resolution={128}>
          <Lightformer intensity={1.5} color={palette.detail} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={0.8} color={palette.spark} position={[6, 1, -2]} rotation-y={-Math.PI / 2} scale={[12, 3, 1]} />
        </Environment>
      </Canvas>
    </SceneBoundary>
  );
}
