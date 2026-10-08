import { expect, test } from '@playwright/test'

test('league loop: create, caps, join, standings, leave', async ({ browser }) => {
  const errors: string[] = []
  const ownerCtx = await browser.newContext()
  const owner = await ownerCtx.newPage()
  owner.on('pageerror', (e) => errors.push(`owner:${e.message}`))
  await owner.request.post('/api/auth/sign-in/anonymous', { data: {} })

  const stamp = Date.now().toString(36)
  const created = await owner.request.post('/api/leagues', { data: { name: `E2E Owls ${stamp}` } })
  expect(created.ok()).toBeTruthy()
  const { slug } = await created.json()
  expect(typeof slug).toBe('string')

  const second = await owner.request.post('/api/leagues', { data: { name: `E2E Second ${stamp}` } })
  expect(second.status()).toBe(403)
  expect((await second.json()).error).toBe('league-create-limit')

  const memberCtx = await browser.newContext()
  const member = await memberCtx.newPage()
  member.on('pageerror', (e) => errors.push(`member:${e.message}`))
  await member.request.post('/api/auth/sign-in/anonymous', { data: {} })

  const joined = await member.request.post(`/api/leagues/${slug}/join`)
  expect(joined.ok()).toBeTruthy()

  const detail = await member.request.get(`/api/leagues/${slug}`)
  expect(detail.ok()).toBeTruthy()
  const body = await detail.json()
  expect(body.memberCount).toBe(2)
  expect(body.isMember).toBe(true)
  expect(body.standings.length).toBe(2)
  const raw = JSON.stringify(body)
  expect(raw).not.toContain('userId')
  expect(raw).not.toContain('@')
  expect(body.week.start <= body.week.end).toBe(true)
  expect(body.standings[0].dailyPoints.length).toBe(7)

  const renamed = await member.request.patch(`/api/leagues/${slug}`, { data: { name: 'Hacker Rename' } })
  expect(renamed.status()).toBe(403)

  const left = await member.request.post(`/api/leagues/${slug}/leave`)
  expect(left.ok()).toBeTruthy()
  const after = await owner.request.get(`/api/leagues/${slug}`)
  expect((await after.json()).memberCount).toBe(1)

  await member.goto(`/leagues/${slug}`)
  await member.waitForLoadState('networkidle')
  await expect(member.getByText('Standings')).toBeVisible()
  await member.goto('/leagues')
  await member.waitForLoadState('networkidle')
  await expect(member.getByText('Friend leagues')).toBeVisible()

  expect(errors).toEqual([])
  await memberCtx.close()
  await ownerCtx.close()
})
