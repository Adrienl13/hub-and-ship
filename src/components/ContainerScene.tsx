import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  Edges,
  RoundedBox,
  ContactShadows,
  Environment,
  Html,
} from '@react-three/drei'
import { useMemo, Suspense } from 'react'
import type { CartItem } from '@/lib/order'
import {
  CONTAINER_INNER_METERS,
  packContainerPackages,
} from '@/lib/container/packing'

// 20' Dry Van intérieur ISO standard (≈ 33 m³ brut, ~28 m³ utile)
const L = CONTAINER_INNER_METERS.length
const W = CONTAINER_INNER_METERS.width
const H = CONTAINER_INNER_METERS.height

function ContainerShell({ opacity = 1 }: { opacity?: number }) {
  const wallColor = '#b8aea0'
  return (
    <group>
      <mesh position={[0, -H / 2 - 0.011, 0]} receiveShadow>
        <boxGeometry args={[L, 0.02, W]} />
        <meshStandardMaterial
          color="#6e5e4a"
          roughness={0.95}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh position={[0, 0, -W / 2]}>
        <boxGeometry args={[L, H, 0.015]} />
        <meshStandardMaterial
          color={wallColor}
          transparent
          opacity={0.18 * opacity}
        />
      </mesh>
      <mesh position={[-L / 2, 0, 0]}>
        <boxGeometry args={[0.015, H, W]} />
        <meshStandardMaterial
          color={wallColor}
          transparent
          opacity={0.22 * opacity}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[L, H, W]} />
        <meshBasicMaterial visible={false} />
        <Edges color="#1a1a1c" threshold={1} />
      </mesh>
    </group>
  )
}

function LoadingMesh() {
  return (
    <mesh>
      <boxGeometry args={[2, 0.5, 2]} />
      <meshStandardMaterial color="#e8dfd0" />
    </mesh>
  )
}

export function ContainerScene({
  items,
  exploded = false,
}: {
  items: CartItem[]
  exploded?: boolean
}) {
  const { packages, slices, overflowUnits } = useMemo(
    () => packContainerPackages(items),
    [items],
  )

  const EXPLODE_GAP = 0.7
  const explodeOffset = (sliceIndex: number, total: number) => {
    if (!exploded || total <= 1) return { dx: 0, dy: 0 }
    const centered = sliceIndex - (total - 1) / 2
    return {
      dx: centered * EXPLODE_GAP,
      dy: sliceIndex % 2 === 0 ? 0.18 : -0.05,
    }
  }
  const totalSlices = slices.length

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [8, 5.5, 7.5], fov: 35 }}
      style={{ background: 'transparent' }}
    >
      <color attach="background" args={['#f4ede1']} />
      <fog attach="fog" args={['#f4ede1', 18, 32]} />
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
        {packages.map((b, i) => {
          const { dx, dy } = explodeOffset(b.sliceIndex, totalSlices)
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
              <meshStandardMaterial
                color={b.color}
                roughness={0.78}
                metalness={0.05}
              />
            </RoundedBox>
          )
        })}
        {exploded &&
          slices.map((s, i) => {
            const { dx } = explodeOffset(i, totalSlices)
            return (
              <Html
                key={s.productId}
                position={[s.centerX + dx, -H / 2 - 0.25, 0]}
                center
                distanceFactor={10}
                style={{ pointerEvents: 'none' }}
              >
                <div
                  className="shadow-paper whitespace-nowrap rounded-sm border border-black/10 bg-white/95 px-2 py-0.5 text-[10px] font-medium text-foreground"
                  style={{ borderLeft: `3px solid ${s.color}` }}
                >
                  {s.productName} · {s.packedUnits}/{s.requestedUnits}
                  {s.overflowUnits > 0 ? ' hors capacité' : ''}
                </div>
              </Html>
            )
          })}
        {overflowUnits > 0 && (
          <Html
            position={[L / 2 - 0.55, H / 2 + 0.25, 0]}
            center
            distanceFactor={9}
            style={{ pointerEvents: 'none' }}
          >
            <div className="border-destructive/30 shadow-paper whitespace-nowrap rounded-sm border bg-white/95 px-2 py-1 text-[10px] font-medium text-destructive">
              {overflowUnits} unité{overflowUnits > 1 ? 's' : ''} hors capacité
            </div>
          </Html>
        )}
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
  )
}
