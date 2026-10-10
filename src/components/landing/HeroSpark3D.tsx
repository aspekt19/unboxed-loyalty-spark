import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer } from "@react-three/drei";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

const SPARK = "#ff7a2f";
const GRAPHITE = "#2b333f";
const FOG_COLOR = "#070a0f";

/** Reads the OS "reduce motion" setting so the scene can hold still. */
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

/** A reward coin: a thick disc with a five-point star embossed on its face. */
function RewardCoin({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);

  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const spikes = 5;
    const outer = 0.6;
    const inner = 0.25;
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSize: 0.03,
      bevelThickness: 0.02,
      bevelSegments: 2,
    });
  }, []);

  useEffect(() => () => starGeometry.dispose(), [starGeometry]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 0.05);
    if (reduced) return;
    // Rock the coin instead of a full spin so the star keeps facing the reader.
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.55) * 0.5;
    group.current.rotation.z += dt * 0.05;
  });

  return (
    <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.6}>
      <group ref={group} position={[0, 1.2, -0.3]} scale={1.02}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[1.55, 1.55, 0.42, 96]} />
          <meshStandardMaterial
            color={GRAPHITE}
            metalness={0.95}
            roughness={0.22}
            emissive={SPARK}
            emissiveIntensity={0.1}
          />
        </mesh>
        <mesh geometry={starGeometry} position={[0, 0, 0.22]}>
          <meshStandardMaterial
            color={SPARK}
            metalness={0.85}
            roughness={0.3}
            emissive={SPARK}
            emissiveIntensity={0.8}
          />
        </mesh>
        <mesh rotation-x={Math.PI / 2} position={[0, 0, -0.22]}>
          <cylinderGeometry args={[1.55, 1.55, 0.04, 96]} />
          <meshStandardMaterial color={SPARK} metalness={0.8} roughness={0.35} />
        </mesh>
      </group>
    </Float>
  );
}

/** A punch card whose stamps fill in one by one — the core loyalty loop. */
function StampCard({ reduced }: { reduced: boolean }) {
  const stamps = useRef<THREE.Mesh[]>([]);

  const layout = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        pos: [
          -1.05 + (i % 4) * 0.7,
          i < 4 ? 0.42 : -0.42,
          0.1,
        ] as [number, number, number],
      })),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const fill = reduced ? 8 : Math.floor(((state.clock.elapsedTime % 9) / 9) * 9);
    stamps.current.forEach((mesh, i) => {
      if (!mesh) return;
      const earned = i < fill;
      const target = earned ? 1 : 0.62;
      const next = mesh.scale.x + (target - mesh.scale.x) * Math.min(1, dt * 7);
      mesh.scale.setScalar(next);
      const material = mesh.material as THREE.MeshStandardMaterial;
      const glow = earned ? 0.85 : 0.05;
      material.emissiveIntensity += (glow - material.emissiveIntensity) * Math.min(1, dt * 7);
    });
  });

  return (
    <Float speed={0.9} rotationIntensity={0.12} floatIntensity={0.35}>
      <group position={[-4.1, -2.4, 0.1]} rotation={[0.12, 0.45, 0.08]}>
        <mesh>
          <boxGeometry args={[3.1, 1.5, 0.14]} />
          <meshStandardMaterial color={GRAPHITE} metalness={0.55} roughness={0.45} />
        </mesh>
        {layout.map((stamp, i) => (
          <mesh
            key={i}
            position={stamp.pos}
            rotation-x={Math.PI / 2}
            ref={(mesh) => {
              if (mesh) stamps.current[i] = mesh;
            }}
          >
            <cylinderGeometry args={[0.22, 0.22, 0.06, 40]} />
            <meshStandardMaterial
              color="#3a4452"
              metalness={0.7}
              roughness={0.35}
              emissive={SPARK}
              emissiveIntensity={0.05}
            />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

/** Gift-card slabs drifting around the coin. */
function FloatingCards({ count, reduced }: { count: number; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);

  const cards = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const radius = 4.4 + (i % 2) * 0.8;
        return {
          pos: [
            Math.cos(angle) * radius,
            ((i % 3) - 1) * 0.9,
            Math.sin(angle) * radius - 1,
          ] as [number, number, number],
          tilt: (i % 4) * 0.3 - 0.4,
          hot: i % 2 === 0,
        };
      }),
    [count],
  );

  useFrame((_, delta) => {
    if (!group.current || reduced) return;
    const dt = Math.min(delta, 0.05);
    group.current.rotation.y += dt * 0.09;
    group.current.children.forEach((child, i) => {
      child.rotation.y += dt * (0.15 + i * 0.04);
    });
  });

  return (
    <group ref={group} rotation={[0.3, 0, 0.06]}>
      {cards.map((card, i) => (
        <mesh key={i} position={card.pos} rotation={[card.tilt, 0, card.tilt * 0.5]}>
          <boxGeometry args={[1.15, 0.72, 0.06]} />
          <meshStandardMaterial
            color={card.hot ? SPARK : "#39424f"}
            metalness={0.88}
            roughness={0.3}
            emissive={SPARK}
            emissiveIntensity={card.hot ? 0.4 : 0.05}
          />
        </mesh>
      ))}
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
  const [cardCount, setCardCount] = useState(6);

  useEffect(() => {
    setCardCount(window.innerWidth < 640 ? 4 : 6);
  }, []);

  return (
    <SceneBoundary>
      <Canvas
        camera={{ position: [0, 0, 9], fov: 50 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <fog attach="fog" args={[FOG_COLOR, 8, 22]} />
        <ambientLight intensity={1.0} color="#cdd6e4" />
        <directionalLight position={[6, 8, 6]} intensity={2.3} color="#ffffff" />
        <pointLight position={[-6, -3, 4]} intensity={45} decay={2} color={SPARK} />
        <pointLight position={[0, 4, -6]} intensity={35} decay={2} color="#8fb6ff" />

        <RewardCoin reduced={reduced} />
        <StampCard reduced={reduced} />
        <FloatingCards count={cardCount} reduced={reduced} />

        <Environment resolution={128}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer
            intensity={1.4}
            color={SPARK}
            position={[-6, 1, -2]}
            rotation-y={Math.PI / 2}
            scale={[12, 3, 1]}
          />
          <Lightformer
            intensity={1}
            color="#8fb6ff"
            position={[6, -1, 2]}
            rotation-y={-Math.PI / 2}
            scale={[12, 3, 1]}
          />
        </Environment>
      </Canvas>
    </SceneBoundary>
  );
}
