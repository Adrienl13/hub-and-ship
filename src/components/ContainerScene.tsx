import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Edges,
  RoundedBox,
  ContactShadows,
  Environment,
  Html,
} from "@react-three/drei";
import { useMemo, Suspense } from "react";
import type { CartItem } from "@/lib/order";

// 20' High Cube intérieur utile (m)
const L = 5.9;
const W = 2.34;
const H = 2.69;

type BoxInstance = {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  productId: string;
  productName: string;
  sliceIndex: number;
  sliceCenterX: number;
};

type Slice = {
  productId: string;
  productName: string;
  centerX: number;
  color: string;
  qty: number;
};

function packBoxes(items: CartItem[]): { boxes: BoxInstance[]; slices: Slice[] } {
  const boxes: BoxInstance[] = [];
  const slices: Slice[] = [];
  let xCursor = -L / 2;
  let sliceIndex = 0;

  for (const item of items) {
    if (item.quantity <= 0) continue;
    const dims = item.product.dimensions; // cm
    let w = dims.w / 100; // depth (Z)
    const d = dims.l / 100; // width along container length (X)
    let h = dims.h / 100; // vertical (Y)
    // clamp
    if (h > H) h = H * 0.95;
    if (w > W) w = W * 0.95;

    const cellsW = Math.max(1, Math.floor(W / w));
    const cellsH = Math.max(1, Math.floor(H / h));
    const perCol = cellsW * cellsH;
    const colsNeeded = Math.ceil(item.quantity / perCol);

    const usedW = cellsW * w;
    const zStart = -W / 2 + (W - usedW) / 2 + w / 2;
    const sliceWidth = colsNeeded * d;
    const sliceCenterX = xCursor + sliceWidth / 2;

    for (let i = 0; i < item.quantity; i++) {
      const colIdx = Math.floor(i / perCol);
      const within = i % perCol;
      const layer = Math.floor(within / cellsW);
      const wIdx = within % cellsW;

      const x = xCursor + colIdx * d + d / 2;
      const y = -H / 2 + layer * h + h / 2;
      const z = zStart + wIdx * w;
      boxes.push({
        pos: [x, y, z],
        size: [d * 0.96, h * 0.96, w * 0.96],
        color: item.variant.hex,
        productId: item.product.id,
        productName: item.product.name,
        sliceIndex,
        sliceCenterX,
      });
    }
    slices.push({
      productId: item.product.id,
      productName: item.product.name,
      centerX: sliceCenterX,
      color: item.variant.hex,
      qty: item.quantity,
    });
    xCursor += sliceWidth + 0.04;
    sliceIndex++;
  }
  return { boxes, slices };
}

function ContainerShell({ opacity = 1 }: { opacity?: number }) {
  const wallColor = "#b8aea0";
  return (
    <group>
      <mesh position={[0, -H / 2 - 0.011, 0]} receiveShadow>
        <boxGeometry args={[L, 0.02, W]} />
        <meshStandardMaterial color="#6e5e4a" roughness={0.95} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, 0, -W / 2]}>
        <boxGeometry args={[L, H, 0.015]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0.18 * opacity} />
      </mesh>
      <mesh position={[-L / 2, 0, 0]}>
        <boxGeometry args={[0.015, H, W]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0.22 * opacity} />
      </mesh>
      <mesh>
        <boxGeometry args={[L, H, W]} />
        <meshBasicMaterial visible={false} />
        <Edges color="#1a1a1c" threshold={1} />
      </mesh>
    </group>
  );
}

function LoadingMesh() {
  return (
    <mesh>
      <boxGeometry args={[2, 0.5, 2]} />
      <meshStandardMaterial color="#e8dfd0" />
    </mesh>
  );
}

export function ContainerScene({
  items,
  exploded = false,
}: {
  items: CartItem[];
  exploded?: boolean;
}) {
  const { boxes, slices } = useMemo(() => packBoxes(items), [items]);

  const EXPLODE_GAP = 0.7;
  const explodeOffset = (sliceIndex: number, total: number) => {
    if (!exploded || total <= 1) return { dx: 0, dy: 0 };
    const centered = sliceIndex - (total - 1) / 2;
    return {
      dx: centered * EXPLODE_GAP,
      dy: sliceIndex % 2 === 0 ? 0.18 : -0.05,
    };
  };
  const totalSlices = slices.length;

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
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <directionalLight position={[-6, 4, -4]} intensity={0.25} />
      <Suspense fallback={<LoadingMesh />}>
        <Environment preset="warehouse" />
      </Suspense>

      <group position={[0, 0.25, 0]}>
        <ContainerShell opacity={exploded ? 0.25 : 1} />
        {boxes.map((b, i) => {
          const { dx, dy } = explodeOffset(b.sliceIndex, totalSlices);
          return (
            <RoundedBox
              key={i}
              args={b.size}
              radius={0.012}
              smoothness={2}
              position={[b.pos[0] + dx, b.pos[1] + dy, b.pos[2]]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={b.color} roughness={0.78} metalness={0.05} />
            </RoundedBox>
          );
        })}
        {exploded &&
          slices.map((s, i) => {
            const { dx } = explodeOffset(i, totalSlices);
            return (
              <Html
                key={s.productId}
                position={[s.centerX + dx, -H / 2 - 0.25, 0]}
                center
                distanceFactor={10}
                style={{ pointerEvents: "none" }}
              >
                <div
                  className="whitespace-nowrap rounded-sm border border-black/10 bg-white/95 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-paper"
                  style={{ borderLeft: `3px solid ${s.color}` }}
                >
                  {s.productName} · {s.qty}
                </div>
              </Html>
            );
          })}
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
        maxDistance={16}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate
        autoRotateSpeed={0.45}
      />
    </Canvas>
  );
}
