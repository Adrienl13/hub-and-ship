export interface ProjectSelection {
  lines: Array<{ ref: string; designId: string; design: string; qty: number }>
  delivery: string
}
export interface PartnerPrefill {
  profile: string
  status: string
  nonce: number
}
export function startPage(
  kind: string,
  root: HTMLElement,
  onSelection: (selection: ProjectSelection) => void,
  onPartner?: (prefill: PartnerPrefill) => void,
): () => void
