# Ghost60 — Analytics notes (first-party `product_events`, no vendor SDK)

Ingest: batched `POST /api/events` (allowlisted names, ≤25/batch, ≤32KB body,
flat scalar props ≤10 keys, strings ≤140 chars). Raw `anonId` is SHA-256 hashed
server-side into `anon_id_hash`; never store emails, IPs, ghost streams, or
free-form text. Auth required — every visitor holds a Better Auth anonymous
session, so `user_id` is the primary identity key and `anon_id_hash` bridges
pre/post-link analysis (the hash input is a random client UUID, stable across
link since localStorage survives it).

Billing events (`checkout_started`, `subscription_*`) are intentionally absent
until Stripe launches; only `paywall_viewed` is tracked. `score_validated` /
`score_rejected` are server-known and should ship later as server-side emission
from the submit route — do not accept them as client claims.

## Activation (did a visitor become a player?)

```sql
-- visitors -> session started -> finished run, last 14 days
select
  date_trunc('day', created_at) as day,
  count(distinct case when event_name = 'daily_game_viewed' then user_id end) as viewers,
  count(distinct case when event_name = 'ranked_session_started' then user_id end) as starters,
  count(distinct case when event_name = 'ranked_run_finished' then user_id end) as finishers
from product_events
where created_at > now() - interval '14 days'
group by 1 order by 1;
-- targets: landing/challenge -> start 45%+, start -> finish 75%+
```

## Challenge funnel (north star: weekly completed friend races)

```sql
-- weekly friend races: challenge_finished events per week
select date_trunc('week', created_at) as week, count(*) as friend_races,
  count(distinct user_id) as racers
from product_events where event_name = 'challenge_finished'
group by 1 order by 1;

-- funnel: created -> landing viewed -> started -> finished -> revenge shared
select event_name, count(*) as events, count(distinct user_id) as users
from product_events
where event_name in ('challenge_created','challenge_landing_viewed','challenge_started','challenge_finished','revenge_shared')
  and created_at > now() - interval '7 days'
group by 1;
-- targets: open -> start 35%+, start -> finish 75%+, result -> share 20%+
-- kill signal: open -> start < 20% after UX iteration = weak shared artifact
```

## D1 / D7 retention

```sql
-- D1/D7: users active again 1 and 7 days after first ranked finish
with firsts as (
  select user_id, min(date_trunc('day', created_at)) as d0
  from product_events where event_name = 'ranked_run_finished'
  group by user_id
)
select
  count(*) as cohort,
  count(*) filter (where exists (
    select 1 from product_events e
    where e.user_id = firsts.user_id
      and e.created_at >= firsts.d0 + interval '1 day'
      and e.created_at < firsts.d0 + interval '2 days')) as d1,
  count(*) filter (where exists (
    select 1 from product_events e
    where e.user_id = firsts.user_id
      and e.created_at >= firsts.d0 + interval '7 days'
      and e.created_at < firsts.d0 + interval '8 days')) as d7
from firsts where d0 < now() - interval '8 days';
-- targets: D1 30%+, D7 15-20%+
```

## Conversion (post-launch, after Stripe)

```sql
-- paywall views -> subscription starts (mature active base)
select
  count(distinct case when event_name = 'paywall_viewed' then user_id end) as viewers,
  count(distinct case when event_name = 'subscription_started' then user_id end) as converted
from product_events where created_at > now() - interval '30 days';
-- target: 2%+ of mature active before aggressive optimization
```

## Hygiene

- `product_events_event_time_idx (event_name, created_at desc)` serves all queries above.
- If daily volume exceeds ~500k rows, add monthly partitions on `created_at`.
- Deletion flow (`DELETE /api/account`) removes a user's rows; aggregates keep
  only anonymous counts by construction (no PII in props to scrub).
