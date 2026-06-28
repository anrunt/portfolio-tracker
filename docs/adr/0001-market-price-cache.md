# Use shared Redis cache for user price refreshes

User-facing market price refreshes use a shared Upstash Redis cache, while snapshot price fetches bypass the cache entirely. This avoids relying on per-instance in-memory state on Vercel/serverless deployments, reduces repeated external provider calls during user interaction, and keeps snapshots based on live provider data rather than potentially stale cached prices.
