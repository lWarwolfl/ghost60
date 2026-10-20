export function shareMessage({
  score,
  gameTitle,
  challengeHandle
}: {
  score: number
  gameTitle: string
  challengeHandle?: string | null
}) {
  if (challengeHandle) {
    const handle = challengeHandle.startsWith('@') ? challengeHandle : `@${challengeHandle}`
    return `I raced ${handle}'s ghost on ${gameTitle} and scored ${score}. Think you can catch me?`
  }
  return `I scored ${score} on ${gameTitle}. Can you catch my ghost?`
}
