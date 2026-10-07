export const HOST =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
