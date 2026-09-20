import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const copper = "#BF6A2E";
const lightCopper = "#D98A4F";
const gold = "#D4A94A";

function CameraMotion() {
  const { camera, pointer } = useThree();
  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.18, 0.025);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, pointer.y * 0.1, 0.025);
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, -pointer.x * 0.012, 0.025);
  });
  return null;
}

function Rings() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (group.current) { group.current.rotation.x += delta * 0.025; group.current.rotation.y += delta * 0.04; } });
  return <group ref={group} rotation={[0.9, 0.2, 0.1]}><mesh><torusGeometry args={[2.6, 0.018, 16, 160]} /><meshStandardMaterial color={gold} metalness={1} roughness={0.24} emissive={gold} emissiveIntensity={0.12} transparent opacity={0.46} /></mesh><mesh rotation={[0.45, 0.2, 0.8]}><torusGeometry args={[3.35, 0.012, 16, 160]} /><meshStandardMaterial color={lightCopper} metalness={1} roughness={0.3} emissive={lightCopper} emissiveIntensity={0.08} transparent opacity={0.3} /></mesh><mesh rotation={[-0.3, 0.5, 0.3]}><torusGeometry args={[4.05, 0.009, 16, 160]} /><meshStandardMaterial color={copper} metalness={1} roughness={0.38} transparent opacity={0.2} /></mesh></group>;
}

function Particles({ count = 520 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => { const data = new Float32Array(count * 3); for (let i = 0; i < count * 3; i += 3) { data[i] = (Math.random() - 0.5) * 14; data[i + 1] = (Math.random() - 0.5) * 9; data[i + 2] = (Math.random() - 0.5) * 10; } return data; }, [count]);
  useFrame((_, delta) => { if (points.current) points.current.rotation.y += delta * 0.012; });
  return <points ref={points}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} array={positions} itemSize={3} /></bufferGeometry><pointsMaterial color={gold} size={0.018} transparent opacity={0.32} sizeAttenuation depthWrite={false} /></points>;
}

function FloatingObjects() {
  return <><Float speed={0.35} rotationIntensity={0.5} floatIntensity={0.7}><mesh position={[-4.3, 2.3, -1]}><icosahedronGeometry args={[0.28, 1]} /><meshStandardMaterial color={copper} metalness={0.9} roughness={0.26} emissive={copper} emissiveIntensity={0.12} /></mesh></Float><Float speed={0.25} rotationIntensity={0.45} floatIntensity={0.6}><mesh position={[4.2, -1.6, -0.6]}><octahedronGeometry args={[0.24]} /><meshStandardMaterial color={gold} metalness={0.9} roughness={0.25} /></mesh></Float><Float speed={0.2} rotationIntensity={0.35} floatIntensity={0.5}><mesh position={[4.4, 2.4, -1.5]}><torusKnotGeometry args={[0.16, 0.045, 64, 10]} /><meshStandardMaterial color={lightCopper} metalness={1} roughness={0.22} /></mesh></Float></>;
}

function EnergyTrail({ color, offset }: { color: string; offset: number }) {
  const marker = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(-5, -1 + offset, -2), new THREE.Vector3(-2, 1.8 + offset, -1), new THREE.Vector3(1.8, -1.5 + offset, -1.5), new THREE.Vector3(5, 1 + offset, -2)]), [offset]);
  useFrame(({ clock }) => { const t = (clock.getElapsedTime() * 0.035 + offset * 0.03) % 1; if (marker.current) marker.current.position.copy(curve.getPointAt(t)); });
  return <><Line points={curve.getPoints(80)} color={color} transparent opacity={0.16} lineWidth={0.7} /><mesh ref={marker}><sphereGeometry args={[0.045, 10, 10]} /><meshBasicMaterial color={color} transparent opacity={0.8} /></mesh></>;
}

function Network() {
  const group = useRef<THREE.Group>(null);
  const points = useMemo(() => Array.from({ length: 60 }, () => new THREE.Vector3((Math.random() - 0.5) * 11, (Math.random() - 0.5) * 6.5, (Math.random() - 0.5) * 4)), []);
  useFrame(({ clock }) => { if (group.current) group.current.position.x = Math.sin(clock.getElapsedTime() * 0.08) * 0.08; });
  const lines: THREE.Vector3[][] = [];
  points.forEach((point, index) => points.slice(index + 1).forEach((other) => { if (point.distanceTo(other) < 1.35) lines.push([point, other]); }));
  return <group ref={group}>{lines.map((line, index) => <Line key={index} points={line} color={gold} transparent opacity={0.17} lineWidth={0.4} />)}</group>;
}

function SceneContents({ mobile, reduced }: { mobile: boolean; reduced: boolean }) {
  if (reduced) return null;
  return <><ambientLight intensity={0.24} color="#8f6748" /><pointLight position={[3, 2, 2]} intensity={3} distance={8} color={gold} /><pointLight position={[-4, -2, 1]} intensity={1.5} distance={7} color={copper} /><directionalLight position={[0, 4, 3]} intensity={0.5} color={lightCopper} /><CameraMotion /><Rings /><Particles count={mobile ? 180 : 540} /><Network /><FloatingObjects /><EnergyTrail color={gold} offset={0} /><EnergyTrail color={lightCopper} offset={2} /></>;
}

export function CinematicScene() {
  const [available, setAvailable] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => { const canvas = document.createElement("canvas"); setAvailable(Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))); setMobile(window.matchMedia("(max-width: 767px)").matches); setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  if (!available) return null;
  return <div className="stage-webgl" aria-hidden="true"><Canvas dpr={[1, 1.8]} camera={{ position: [0, 0, 8], fov: 42 }} gl={{ alpha: true, antialias: true }}><SceneContents mobile={mobile} reduced={reduced} /></Canvas></div>;
}
