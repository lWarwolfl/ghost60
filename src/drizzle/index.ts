import * as schema from './schema'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const globalForDb = globalThis as unknown as { dbClient?: ReturnType<typeof postgres> }

export const dbClient = globalForDb.dbClient ?? postgres(process.env.DATABASE_URL!, { prepare: false })

if (process.env.NODE_ENV !== 'production') globalForDb.dbClient = dbClient

export const db = drizzle(dbClient, { schema })
export type TDatabase = typeof db
