import type { CSSProperties, ReactNode } from 'react'
import type { TSkin } from '@/lib/game/skins'

export function SkinCardFrame({ skin, children, className = '' }: { skin: TSkin; children: ReactNode; className?: string }) {
  const accent = skin.resultCard.accent
  const secondary = skin.trail.secondary
  const patterns: Record<string, string> = {
    'spectral-line': `linear-gradient(120deg, ${accent}12, transparent 55%, ${secondary}12)`,
    'micro-static': `repeating-linear-gradient(0deg, transparent 0 7px, ${accent}12 7px 8px)`,
    'mono-lines': 'repeating-linear-gradient(135deg, transparent 0 16px, #F5F7FF0B 16px 17px)',
    'violet-ribbon': `linear-gradient(155deg, transparent 20%, ${accent}20 48%, ${secondary}18 51%, transparent 80%)`,
    'digital-squares': `repeating-linear-gradient(0deg, transparent 0 15px, ${accent}0D 15px 16px), repeating-linear-gradient(90deg, transparent 0 15px, ${accent}0D 15px 16px)`,
    'heat-ribbon': `linear-gradient(165deg, transparent 20%, ${accent}18 45%, ${secondary}1C 55%, transparent 80%)`,
    'rgb-split': 'linear-gradient(92deg, #62F7E60F, transparent 48%, #FF66DB12)',
    'long-ribbon': `linear-gradient(135deg, ${accent}18, transparent 30%, ${secondary}15 55%, transparent 80%, ${accent}18)`,
    scanline: `repeating-linear-gradient(0deg, transparent 0 3px, ${accent}12 3px 4px)`
  }
  const style: CSSProperties = {
    borderColor: `${accent}66`,
    backgroundImage: patterns[skin.resultCard.backgroundEffect] ?? patterns['spectral-line']
  }
  return <div data-skin={skin.id} className={`rounded-card border bg-ink-900 ${className}`} style={style}>{children}</div>
}
