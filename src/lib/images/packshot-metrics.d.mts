export const DECISION_PIPELINE_VERSION: string
export const DECISION_MARGIN: number
export const DECISION_SIZES: readonly number[]
export interface PixelBox {
  x: number
  y: number
  w: number
  h: number
}
export interface PackshotAnalysis {
  box: PixelBox
  background: number
  quality: {
    background: number
    center: number
    frame: number
    margin: number
    sharpness: number
  }
  quality_score: number
  traits: {
    silhouette_ratio: number
    edge_density: number
    global_contrast: number
    dominant_colors: { hex: string; proportion: number }[]
    openness: number
    pattern_score: number
  }
}
export function analyzePackshot(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels?: number,
): PackshotAnalysis | null
export function decisionPlacement(
  box: PixelBox,
  size: number,
): { width: number; height: number; left: number; top: number }
