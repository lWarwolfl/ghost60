import { randomBytes } from 'node:crypto'

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function generateSlug(length = 12) {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}
