import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { CartItem } from '@/lib/order'
import {
  getContainerInnerMeters,
  packContainerPackages,
} from '@/lib/container/packing'
import type { PackedPackage } from '@/lib/container/packing'
import type { ContainerType } from '@/lib/supabase/types'

interface SceneRotation {
  readonly x: number
  readonly y: number
}

interface DragState {
  readonly startX: number
  readonly startY: number
  readonly rotation: SceneRotation
}

const INITIAL_ROTATION: SceneRotation = { x: -0.08, y: -0.52 }

/** Lightweight check: phones get a smaller GPU budget than laptops.
 *  We rely on coarse pointer + narrow viewport rather than UA sniffing. */
function useIsMobileDevice(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(pointer: coarse), (max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  return isMobile
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function ContainerShell({
  opacity = 1,
  L,
  W,
  H,
}: {
  opacity?: number
  L: number
  W: number
  H: number
}) {
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
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[L, 0.012, W]} />
        <meshStandardMaterial
          color={wallColor}
          transparent
          opacity={0.08 * opacity}
        />
      </mesh>
    </group>
  )
}

function PackageBox({ box }: { box: PackedPackage }) {
  const renderColor = box.reserved ? '#b6aea3' : box.color

  return (
    <mesh position={box.pos} castShadow={!box.reserved} receiveShadow>
      <boxGeometry args={box.size} />
      <meshStandardMaterial
        color={renderColor}
        transparent={box.reserved}
        opacity={box.reserved ? 0.38 : 1}
        roughness={box.reserved ? 0.92 : 0.78}
        metalness={0.03}
      />
    </mesh>
  )
}

function SceneContent({
  items,
  exploded,
  containerType,
  rotation,
}: {
  items: CartItem[]
  exploded: boolean
  containerType?: ContainerType | null
  rotation: SceneRotation
}) {
  const dims = useMemo(
    () => getContainerInnerMeters(containerType),
    [containerType],
  )
  const { packages, slices } = useMemo(
    () => packContainerPackages(items, containerType),
    [items, containerType],
  )
  const renderPackages = useMemo(
    () => [...packages].sort((a, b) => Number(b.reserved) - Number(a.reserved)),
    [packages],
  )
  const totalSlices = slices.length
  const explodeOffset = (sliceIndex: number, total: number) => {
    if (!exploded || total <= 1) return { dx: 0, dy: 0 }
    const centered = sliceIndex - (total - 1) / 2
    return {
      dx: centered * 0.7,
      dy: sliceIndex % 2 === 0 ? 0.18 : -0.05,
    }
  }

  return (
    <>
      <color attach="background" args={['#f4ede1']} />
      <fog attach="fog" args={['#f4ede1', 18, 32]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[7, 10, 6]} intensity={1.1} />
      <directionalLight position={[-6, 4, -4]} intensity={0.3} />

      <group position={[0, 0.25, 0]} rotation={[rotation.x, rotation.y, 0]}>
        <ContainerShell
          opacity={exploded ? 0.25 : 1}
          L={dims.length}
          W={dims.width}
          H={dims.height}
        />
        {renderPackages.map((box, index) => {
          const { dx, dy } = explodeOffset(box.sliceIndex, totalSlices)
          return (
            <group
              key={`${box.productId}:${box.sliceIndex}:${box.packageIndex}:${box.reserved ? 'reserved' : 'live'}:${index}`}
              position={[dx, dy, 0]}
            >
              <PackageBox box={box} />
            </group>
          )
        })}
      </group>
    </>
  )
}

export function ContainerScene({
  items,
  exploded = false,
  containerType,
}: {
  items: CartItem[]
  exploded?: boolean
  containerType?: ContainerType | null
}) {
  const isMobile = useIsMobileDevice()
  const drag = useRef<DragState | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [rotation, setRotation] = useState<SceneRotation>(INITIAL_ROTATION)
  const packed = useMemo(
    () => packContainerPackages(items, containerType),
    [items, containerType],
  )

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      rotation,
    }
    setIsDragging(true)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    const dx = (event.clientX - drag.current.startX) * 0.01
    const dy = (event.clientY - drag.current.startY) * 0.006
    setRotation({
      x: clamp(drag.current.rotation.x + dy, -0.65, 0.45),
      y: drag.current.rotation.y + dx,
    })
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    drag.current = null
    setIsDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className={`absolute inset-0 touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        role="img"
        aria-label="Vue 3D du chargement container, manipulable par glisser."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <Canvas
          frameloop="demand"
          shadows={!isMobile}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
          camera={{ position: [8, 5.5, 7.5], fov: 35 }}
          style={{ background: 'transparent' }}
        >
          <SceneContent
            items={items}
            exploded={exploded}
            containerType={containerType}
            rotation={rotation}
          />
        </Canvas>
      </div>
      {packed.overflowUnits > 0 && (
        <div className="border-destructive/30 shadow-paper absolute right-3 top-3 z-10 whitespace-nowrap rounded-sm border bg-white/95 px-2 py-1 text-[10px] font-medium text-destructive">
          {packed.overflowUnits} unité
          {packed.overflowUnits > 1 ? 's' : ''} hors capacité
        </div>
      )}
      {exploded && packed.slices.length > 0 && (
        <div className="shadow-paper absolute bottom-3 right-3 z-10 max-w-[78%] rounded-sm border border-black/10 bg-white/95 px-2 py-1 text-[10px] font-medium text-foreground">
          {packed.slices.slice(0, 3).map((slice) => (
            <div
              key={`${slice.productId}:${slice.color}`}
              className="flex items-center gap-1.5 whitespace-nowrap"
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: slice.color }}
              />
              <span className="truncate">
                {slice.productName} · {slice.packedUnits}/{slice.requestedUnits}
                {slice.overflowUnits > 0 ? ' hors capacité' : ''}
              </span>
            </div>
          ))}
          {packed.slices.length > 3 && (
            <div className="text-muted-foreground">
              +{packed.slices.length - 3} autre
              {packed.slices.length - 3 > 1 ? 's' : ''} ligne
            </div>
          )}
        </div>
      )}
    </div>
  )
}
