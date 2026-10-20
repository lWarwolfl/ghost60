'use client'

export function PromptFlash({
  label,
  tone = 'cyan'
}: {
  label: string
  tone?: 'cyan' | 'violet' | 'lime'
}) {
  if (!label) return null
  return (
    <div className="game-prompt" data-tone={tone} aria-live="polite">
      <span>{label}</span>
    </div>
  )
}
