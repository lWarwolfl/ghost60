export type TShiftRule = 'normal' | 'reversed'

export function shiftRuleFor(cardIndex: number): TShiftRule {
  return cardIndex % 5 === 4 ? 'reversed' : 'normal'
}

export function arrowFor(correct: 0 | 1, cardIndex: number): 0 | 1 {
  return shiftRuleFor(cardIndex) === 'reversed' ? ((1 - correct) as 0 | 1) : correct
}

export function answerFor(arrow: 0 | 1, cardIndex: number): 0 | 1 {
  return shiftRuleFor(cardIndex) === 'reversed' ? ((1 - arrow) as 0 | 1) : arrow
}

export function currentShiftCard(cardCount: number, choiceCount: number) {
  if (choiceCount >= cardCount) return -1
  return choiceCount
}
