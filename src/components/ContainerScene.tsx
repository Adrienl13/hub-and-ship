import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges, RoundedBox, ContactShadows, Environment } from "@react-three/drei";
import { useMemo } from "react";
import type { Product } from "@/lib/products";

// Internal 20ft High Cube container dims (m) — usable
const L = 5.9;
const W = 2.34;
const H = 2.69;

type BoxInstance = {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  productId: string;
};

// Realistic shelf-packer: each product gets a contiguous slice along the container length.
// Within that slice, packs are placed in a (depth × width × height) grid sized to packDim.
function packBoxes(items: { product: Product; qty: number; color: string }[]): BoxInstance[] {
  const boxes: BoxInstance[] = [];
  let xCursor = -L / 2;

  for (const { product, qty, color } of items) {
    if (qty <= 0) continue;
    const packs = Math.ceil(qty / product.packQty);
    let [w, d, h] = product.packDim;
    // Orient so the longest side runs along X (container length) for tall items like parasols
    if (h > L) {
      // lay it down: swap height with depth
      [d, h] = [h, d];
    }
    if (h > H) h = H * 0.98; // visual clamp

    const cellsW = Math.max(1, Math.floor(W / w));
    const cellsH = Math.max(1, Math.floor(H / h));
    const perCol = cellsW * cellsH; // packs per slice along X
    const colsNeeded = Math.ceil(packs / perCol);

    // Center the slice's content in the available width
    const usedW = cellsW * w;
    const zStart = -W / 2 + (W - usedW) / 2 + w / 2;

    for (let i = 0; i < packs; i++) {
      const colIdx = Math.floor(i / perCol);
      const within = i % perCol;
      const layer = Math.floor(within / cellsW);
      const wIdx = within % cellsW;

      const x = xCursor + colIdx * d + d / 2;
      const y = -H / 2 + layer * h + h / 2;
      const z = zStart + wIdx * w;

      boxes.push({
        pos: [x, y, z],
        size: [d * 0.97, h * 0.97, w * 0.97],
        color,
        productId: product.id,
      });
    }
    xCursor += colsNeeded * d + 0.04;
  }
  return boxes;
}

function ContainerShell() {
  const wallColor = "#b8aea0";
  return (
    <group>
      {/* Floor (corrugated wood-look) */}
      <mesh position={[0, -H / 2 - 0.011, 0]} receiveShadow>
        <boxGeometry args={[L, 0.02, W]} />
        <meshStandardMaterial color="#6e5e4a" roughness={0.95} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 0, -W / 2]}>
        <boxGeometry args={[L, H, 0.015]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0.18} />
      </mesh>
      {/* Front wall (almost invisible so user sees inside) */}
      <mesh position={[0, 0, W / 2]}>
        <boxGeometry args={[L, H, 0.015]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0.04} />
      </mesh>
      {/* Left (closed end) */}
      <mesh position={[-L / 2, 0, 0]}>
        <boxGeometry args={[0.015, H, W]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0.22} />
      </mesh>
      {/* Right (door end) */}
      <mesh position={[L / 2, 0, 0]}>
        <boxGeometry args={[0.015, H, W]} />
        <meshStandardMaterial color="#a8907a" transparent opacity={0.12} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[L, 0.015, W]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0.04} />
      </mesh>
      {/* Frame outline */}
      <mesh>
        <boxGeometry args={[L, H, W]} />
        <meshBasicMaterial visible={false} />
        <Edges color="#2a2a2f" threshold={1} />
      </mesh>
    </group>
  );
}

export function ContainerScene({
  items,
}: {
  items: { product: Product; qty: number; color: string }[];
}) {
  const boxes = useMemo(() => packBoxes(items), [items]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [8, 5.5, 7.5], fov: 35 }}
      style={{ background: "transparent" }}
    >
      <color attach="background" args={["#f4ede1"]} />
      <fog attach="fog" args={["#f4ede1", 18, 32]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[7, 11, 6]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <directionalLight position={[-6, 4, -4]} intensity={0.25} />
      <Environment preset="city" />

      <group position={[0, 0.25, 0]}>
        <ContainerShell />
        {boxes.map((b, i) => (
          <RoundedBox
            key={i}
            args={b.size}
            radius={0.015}
            smoothness={2}
            position={b.pos}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={b.color} roughness={0.78} metalness={0.05} />
          </RoundedBox>
        ))}
        <ContactShadows
          position={[0, -H / 2 + 0.01, 0]}
          opacity={0.35}
          scale={14}
          blur={2.4}
          far={4}
        />
      </group>

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate
        autoRotateSpeed={0.4}
      />
    </Canvas>
  );
}
