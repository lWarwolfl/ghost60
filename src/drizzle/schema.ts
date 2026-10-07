import { relations, sql } from 'drizzle-orm'
import { bigint, boolean, check, date, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

export const User = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  image: text('image'),
  role: text('role').default('user').notNull(),
  isAnonymous: boolean('isAnonymous').default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull().$onUpdate(() => new Date())
})
export type TUser = typeof User.$inferSelect

export const Session = pgTable('session', {
  id: text('id').primaryKey(),
  token: text('token').unique().notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .references(() => User.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull().$onUpdate(() => new Date())
})
export type TSession = typeof Session.$inferSelect

export const Account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .references(() => User.id, { onDelete: 'cascade' })
    .notNull(),
  providerId: text('providerId').notNull(),
  accountId: text('accountId').notNull(),
  issuer: text('issuer'),
  password: text('password'),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull().$onUpdate(() => new Date())
})
export type TAccount = typeof Account.$inferSelect

export const Verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull().$onUpdate(() => new Date())
})
export type TVerification = typeof Verification.$inferSelect

export const PlayerProfile = pgTable('player_profiles', {
  userId: text('user_id').primaryKey(),
  handle: varchar('handle', { length: 24 }).unique(),
  displayName: varchar('display_name', { length: 40 }),
  avatarKey: text('avatar_key').default('base').notNull(),
  activeGhostSkin: text('active_ghost_skin').default('clean').notNull(),
  activeCardSkin: text('active_card_skin').default('clean').notNull(),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date())
})
export type TPlayerProfile = typeof PlayerProfile.$inferSelect

export const Season = pgTable('seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').unique().notNull(),
  name: text('name').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  config: jsonb('config').default({}).notNull()
})
export type TSeason = typeof Season.$inferSelect

export const GameDefinition = pgTable(
  'game_definitions',
  {
    id: text('id').notNull(),
    engineVersion: integer('engine_version').notNull(),
    name: text('name').notNull(),
    skillCategory: text('skill_category').notNull(),
    durationMs: integer('duration_ms').notNull(),
    configSchemaVersion: integer('config_schema_version').default(1).notNull(),
    active: boolean('active').default(true).notNull()
  },
  (t) => [primaryKey({ columns: [t.id, t.engineVersion] })]
)
export type TGameDefinition = typeof GameDefinition.$inferSelect

export const DailyGame = pgTable('daily_games', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameDate: date('game_date').unique().notNull(),
  gameId: text('game_id').notNull(),
  engineVersion: integer('engine_version').notNull(),
  seed: text('seed').notNull(),
  config: jsonb('config').notNull(),
  title: text('title').notNull(),
  instruction: text('instruction').notNull(),
  shareSubtitle: text('share_subtitle').notNull(),
  difficulty: smallint('difficulty').notNull(),
  seasonId: uuid('season_id').references(() => Season.id),
  status: text('status').default('scheduled').notNull(),
  publishAt: timestamp('publish_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
})
export type TDailyGame = typeof DailyGame.$inferSelect

export const RunSession = pgTable('run_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  dailyGameId: uuid('daily_game_id')
    .references(() => DailyGame.id)
    .notNull(),
  mode: text('mode').notNull(),
  challengeId: uuid('challenge_id'),
  state: text('state').notNull(),
  tokenHash: text('token_hash').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  technicalRetryOf: uuid('technical_retry_of'),
  metadata: jsonb('metadata').default({}).notNull()
})
export type TRunSession = typeof RunSession.$inferSelect

export const Run = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .unique()
      .references(() => RunSession.id)
      .notNull(),
    userId: text('user_id').notNull(),
    dailyGameId: uuid('daily_game_id')
      .references(() => DailyGame.id)
      .notNull(),
    mode: text('mode').notNull(),
    rawScore: integer('raw_score').notNull(),
    validatedScore: integer('validated_score').notNull(),
    scoreVersion: integer('score_version').notNull(),
    eventStream: jsonb('event_stream').notNull(),
    eventDigest: text('event_digest').notNull(),
    durationMs: integer('duration_ms').notNull(),
    valid: boolean('valid').notNull(),
    invalidReason: text('invalid_reason'),
    visibilityInterruptions: integer('visibility_interruptions').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (t) => [
    uniqueIndex('runs_one_valid_ranked_per_day')
      .on(t.userId, t.dailyGameId)
      .where(sql`${t.mode} = 'ranked' AND ${t.valid} = true`),
    index('runs_daily_score_idx').on(t.dailyGameId, t.validatedScore.desc()),
    index('runs_user_history_idx').on(t.userId, t.createdAt.desc())
  ]
)
export type TRun = typeof Run.$inferSelect

export const Challenge = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  publicSlug: varchar('public_slug', { length: 12 }).unique().notNull(),
  creatorUserId: text('creator_user_id').notNull(),
  sourceRunId: uuid('source_run_id')
    .references(() => Run.id)
    .notNull(),
  dailyGameId: uuid('daily_game_id')
    .references(() => DailyGame.id)
    .notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  disabledAt: timestamp('disabled_at', { withTimezone: true })
})
export type TChallenge = typeof Challenge.$inferSelect

export const ChallengeAttempt = pgTable(
  'challenge_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challenge_id')
      .references(() => Challenge.id)
      .notNull(),
    recipientUserId: text('recipient_user_id').notNull(),
    runId: uuid('run_id')
      .references(() => Run.id)
      .notNull(),
    outcome: text('outcome').notNull(),
    scoreDelta: integer('score_delta').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (t) => [unique('challenge_attempts_challenge_recipient_uniq').on(t.challengeId, t.recipientUserId)]
)
export type TChallengeAttempt = typeof ChallengeAttempt.$inferSelect

export const Streak = pgTable('streaks', {
  userId: text('user_id').primaryKey(),
  currentCount: integer('current_count').default(0).notNull(),
  longestCount: integer('longest_count').default(0).notNull(),
  lastCompletedDate: date('last_completed_date'),
  graceTokens: integer('grace_tokens').default(0).notNull(),
  graceUsedTotal: integer('grace_used_total').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date())
})
export type TStreak = typeof Streak.$inferSelect

export const XpLedger = pgTable('xp_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  sourceKey: text('source_key').unique().notNull(),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
})
export type TXpLedger = typeof XpLedger.$inferSelect

export const Achievement = pgTable('achievements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  iconKey: text('icon_key').notNull(),
  config: jsonb('config').default({}).notNull()
})
export type TAchievement = typeof Achievement.$inferSelect

export const UserAchievement = pgTable(
  'user_achievements',
  {
    userId: text('user_id').notNull(),
    achievementId: text('achievement_id')
      .references(() => Achievement.id)
      .notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).defaultNow().notNull(),
    context: jsonb('context').default({}).notNull()
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })]
)
export type TUserAchievement = typeof UserAchievement.$inferSelect

export const League = pgTable('leagues', {
  id: uuid('id').primaryKey().defaultRandom(),
  publicSlug: varchar('public_slug', { length: 12 }).unique().notNull(),
  ownerUserId: text('owner_user_id').notNull(),
  name: varchar('name', { length: 40 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true })
})
export type TLeague = typeof League.$inferSelect

export const LeagueMember = pgTable(
  'league_members',
  {
    leagueId: uuid('league_id')
      .references(() => League.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id').notNull(),
    role: text('role').default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull()
  },
  (t) => [primaryKey({ columns: [t.leagueId, t.userId] }), index('league_members_user_idx').on(t.userId)]
)
export type TLeagueMember = typeof LeagueMember.$inferSelect

export const Entitlement = pgTable('entitlements', {
  userId: text('user_id').primaryKey(),
  plan: text('plan').default('free').notNull(),
  provider: text('provider'),
  providerCustomerId: text('provider_customer_id'),
  providerSubscriptionId: text('provider_subscription_id'),
  status: text('status').default('inactive').notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date())
})
export type TEntitlement = typeof Entitlement.$inferSelect

export const Block = pgTable(
  'blocks',
  {
    blockerUserId: text('blocker_user_id').notNull(),
    blockedUserId: text('blocked_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (t) => [primaryKey({ columns: [t.blockerUserId, t.blockedUserId] }), check('blocks_no_self', sql`${t.blockerUserId} <> ${t.blockedUserId}`)]
)
export type TBlock = typeof Block.$inferSelect

export const Report = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterUserId: text('reporter_user_id').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectKey: text('subject_key').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true })
})
export type TReport = typeof Report.$inferSelect

export const ProductEvent = pgTable(
  'product_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    eventName: text('event_name').notNull(),
    userId: text('user_id'),
    anonIdHash: text('anon_id_hash'),
    sessionKey: text('session_key'),
    properties: jsonb('properties').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (t) => [index('product_events_event_time_idx').on(t.eventName, t.createdAt.desc())]
)
export type TProductEvent = typeof ProductEvent.$inferSelect

export const dailyGameRelations = relations(DailyGame, ({ one, many }) => ({
  season: one(Season, { fields: [DailyGame.seasonId], references: [Season.id] }),
  runSessions: many(RunSession),
  runs: many(Run)
}))

export const runSessionRelations = relations(RunSession, ({ one }) => ({
  dailyGame: one(DailyGame, { fields: [RunSession.dailyGameId], references: [DailyGame.id] }),
  run: one(Run, { fields: [RunSession.id], references: [Run.sessionId] })
}))

export const runRelations = relations(Run, ({ one }) => ({
  session: one(RunSession, { fields: [Run.sessionId], references: [RunSession.id] }),
  dailyGame: one(DailyGame, { fields: [Run.dailyGameId], references: [DailyGame.id] })
}))

export const challengeRelations = relations(Challenge, ({ one, many }) => ({
  sourceRun: one(Run, { fields: [Challenge.sourceRunId], references: [Run.id] }),
  dailyGame: one(DailyGame, { fields: [Challenge.dailyGameId], references: [DailyGame.id] }),
  attempts: many(ChallengeAttempt)
}))

export const leagueRelations = relations(League, ({ many }) => ({
  members: many(LeagueMember)
}))

export const leagueMemberRelations = relations(LeagueMember, ({ one }) => ({
  league: one(League, { fields: [LeagueMember.leagueId], references: [League.id] })
}))

export const userAchievementRelations = relations(UserAchievement, ({ one }) => ({
  achievement: one(Achievement, { fields: [UserAchievement.achievementId], references: [Achievement.id] })
}))
