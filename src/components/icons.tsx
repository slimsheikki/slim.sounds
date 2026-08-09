/** Tiny geometric icon set — original, stroke-based, OP-1-adjacent but ours. */
import type { ReactNode } from 'react'

interface IconProps {
  size?: number
  color?: string
}

const S = ({ size = 14, color = 'currentColor', children }: IconProps & { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

export const IconWave = (p: IconProps) => (
  <S {...p}><path d="M1 8h2l1.5-4 2 8 2-10 2 12 1.5-6H15" /></S>
)

export const IconSine = (p: IconProps) => (
  <S {...p}><path d="M1 8c2-6 4.5-6 7 0s5 6 7 0" /></S>
)

export const IconKeys = (p: IconProps) => (
  <S {...p}>
    <rect x="1.5" y="3.5" width="13" height="9" rx="1" />
    <path d="M5.8 3.5v5.5M10.2 3.5v5.5" />
  </S>
)

export const IconSpark = (p: IconProps) => (
  <S {...p}><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.5 3.5l2 2M10.5 10.5l2 2M12.5 3.5l-2 2M5.5 10.5l-2 2" /></S>
)

export const IconGrid = (p: IconProps) => (
  <S {...p}>
    <rect x="1.5" y="5" width="2.6" height="6" rx="0.5" />
    <rect x="5.2" y="3" width="2.6" height="8" rx="0.5" />
    <rect x="8.9" y="6" width="2.6" height="5" rx="0.5" />
    <rect x="12.6" y="4" width="2.6" height="7" rx="0.5" />
  </S>
)

export const IconExport = (p: IconProps) => (
  <S {...p}><path d="M8 1.5v8M5 6.5l3 3 3-3M2 11v2.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V11" /></S>
)

export const IconPlay = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color}><path d="M4 2.5v11l9-5.5z" /></svg>
)

export const IconStop = ({ size = 14, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color}><rect x="3" y="3" width="10" height="10" rx="1" /></svg>
)

export const IconRec = ({ size = 14, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color}><circle cx="8" cy="8" r="5" /></svg>
)

export const IconLoop = (p: IconProps) => (
  <S {...p}><path d="M3 6.5a5 4 0 0 1 10 0M13 9.5a5 4 0 0 1-10 0" /><path d="M13 3.5v3h-3M3 12.5v-3h3" /></S>
)

export const IconSun = ({ size = 14, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round">
    <circle cx="8" cy="8" r="3" fill={color} stroke="none" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M13 3l-1.4 1.4M4.4 11.6L3 13" />
  </svg>
)

export const IconMutate = (p: IconProps) => (
  <S {...p}>
    <rect x="2" y="2" width="12" height="12" rx="2.5" />
    <circle cx="5.5" cy="5.5" r="0.6" fill="currentColor" />
    <circle cx="10.5" cy="5.5" r="0.6" fill="currentColor" />
    <circle cx="8" cy="8" r="0.6" fill="currentColor" />
    <circle cx="5.5" cy="10.5" r="0.6" fill="currentColor" />
    <circle cx="10.5" cy="10.5" r="0.6" fill="currentColor" />
  </S>
)

export const IconUndo = (p: IconProps) => (
  <S {...p}><path d="M6.5 3 3 6.5 6.5 10" /><path d="M3 6.5h6a4 4 0 0 1 0 8H6" /></S>
)

export const IconRedo = (p: IconProps) => (
  <S {...p}><path d="M9.5 3 13 6.5 9.5 10" /><path d="M13 6.5H7a4 4 0 0 0 0 8h3" /></S>
)

export const IconImport = (p: IconProps) => (
  <S {...p}><path d="M2 2.5h5l1.5 2H14a.8.8 0 0 1 .8.8v7.2a1 1 0 0 1-1 1H2.2a1 1 0 0 1-1-1v-9a1 1 0 0 1 .8-1z" /></S>
)

export const IconPreset = (p: IconProps) => (
  <S {...p}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /><circle cx="5.5" cy="4.5" r="1.3" fill="var(--recess, #0c0c0a)" /><circle cx="10" cy="8" r="1.3" fill="var(--recess, #0c0c0a)" /><circle cx="6.5" cy="11.5" r="1.3" fill="var(--recess, #0c0c0a)" /></S>
)

export const IconCopy = (p: IconProps) => (
  <S {...p}><rect x="5.5" y="5.5" width="8" height="8" rx="1" /><path d="M10.5 3.5v-1h-8v8h1" /></S>
)

export const IconLeafWave = (p: IconProps) => (
  <S {...p}><path d="M2 13c0-6 4-10 12-11-1 8-5 12-11 12" /><path d="M2 13c3-3 6-5 9-8" /></S>
)

export const WaveGlyph = ({ wave, size = 22, color = 'currentColor' }: { wave: string; size?: number; color?: string }) => {
  const paths: Record<string, string> = {
    sine: 'M1 8c2-6 4.5-6 7 0s5 6 7 0',
    triangle: 'M1 8l3.5-5 7 10L15 8',
    sawtooth: 'M1 11 8 4v7l7-7',
    square: 'M1 11V5h4.5v6H10V5h5v6',
  }
  return (
    <svg width={size} height={(size * 16) / 22} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[wave] ?? paths.sine} />
    </svg>
  )
}
