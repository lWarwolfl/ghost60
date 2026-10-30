import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous } from 'better-auth/plugins/anonymous'
import { db } from '@/drizzle'
import { Account, Session, User, Verification } from '@/drizzle/schema'
import { migrateAnonymousData } from '@/lib/auth/link-migration'
import { authOrigins } from '@/lib/auth/origins'

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  ...authOrigins(),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user: User, session: Session, account: Account, verification: Verification }
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ''
    }
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user'
      }
    }
  },
  plugins: [
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await migrateAnonymousData(anonymousUser.user.id, newUser.user.id)
      }
    })
  ]
})

export type TAuth = typeof auth
