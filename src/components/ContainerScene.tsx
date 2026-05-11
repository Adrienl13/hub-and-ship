import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges, RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import type { Product } from "@/lib/products";

// Internal 20ft container dims (m)
const L = 5.9;
const W = 2.35;
const H = 2.39;

type BoxInstance = { pos: [number, number, number]; size: number; color: string };

function packBoxes(items: { product: Product; qty: number }[]): BoxInstance[] {
  const boxes: BoxInstance[] = [];
  let xCursor = -L / 2; // along length

  for (const { product, qty } of items) {
    if (qty <= 0) continue;
    const s = Math.max(Math.cbrt(product.cbm), 0.18);
    const cellsW = Math.max(1, Math.floor(W / s));
    const cellsH = Math.max(1, Math.floor(H / s));
    const perLayerCol = cellsW * cellsH; // units per "column" (slice along L)
    const colsNeeded = Math.ceil(qty / perLayerCol);
    const sectionLen = colsNeeded * s;

    if (xCursor + sectionLen > L / 2 + 0.01) {
      // overflow — clamp visually
    }

    for (let i = 0; i < qty; i++) {
      const colIdx = Math.floor(i / perLayerCol);
      const within = i % perLayerCol;
      const layer = Math.floor(within / cellsW); // y
      const wIdx = within % cellsW;              // z

      const x = xCursor + colIdx * s + s / 2;
      const y = -H / 2 + layer * s + s / 2;
      const z = -W / 2 + wIdx * s + s / 2;
      boxes.push({ pos: [x, y, z], size: s * 0.94, color: product.color });
    }
    xCursor += sectionLen + 0.05;
  }
  return boxes;
}

function ContainerShell() {
  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -H / 2 - 0.01, 0]} receiveShadow>
        <boxGeometry args={[L, 0.02, W]} />
        <meshStandardMaterial color="#8a8074" />
      </mesh>
      {/* Walls (semi-transparent) */}
      <mesh position={[0, 0, -W / 2]}>
        <boxGeometry args={[L, H, 0.02]} />
        <meshStandardMaterial color="#cfc8bd" transparent opacity={0.18} />
      </mesh>
      <mesh position={[0, 0, W / 2]}>
        <boxGeometry args={[L, H, 0.02]} />
        <meshStandardMaterial color="#cfc8bd" transparent opacity={0.08} />
      </mesh>
      <mesh position={[-L / 2, 0, 0]}>
        <boxGeometry args={[0.02, H, W]} />
        <meshStandardMaterial color="#cfc8bd" transparent opacity={0.18} />
      </mesh>
      <mesh position={[L / 2, 0, 0]}>
        <boxGeometry args={[0.02, H, W]} />
        <meshStandardMaterial color="#cfc8bd" transparent opacity={0.18} />
      </mesh>
      {/* Roof edges */}
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[L, 0.02, W]} />
        <meshStandardMaterial color="#cfc8bd" transparent opacity={0.05} />
      </mesh>
      {/* Frame outline */}
      <mesh>
        <boxGeometry args={[L, H, W]} />
        <meshBasicMaterial visible={false} />
        <Edges color="#3a3a3f" threshold={1} />
      </mesh>
    </group>
  );
}

export function ContainerScene({
  items,
}: {
  items: { product: Product; qty: number }[];
}) {
  const boxes = useMemo(() => packBoxes(items), [items]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [7, 5, 7], fov: 38 }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-6, 4, -4]} intensity={0.3} />

      <group position={[0, 0.2, 0]}>
        <ContainerShell />
        {boxes.map((b, i) => (
          <RoundedBox
            key={i}
            args={[b.size, b.size, b.size]}
            radius={0.02}
            smoothness={2}
            position={b.pos}
            castShadow
          >
            <meshStandardMaterial color={b.color} roughness={0.7} />
          </RoundedBox>
        ))}
      </group>

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
