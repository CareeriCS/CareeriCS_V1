# Railway Deployment

- Service root directory: `AI_API/fast-api-app`
- Builder: Nixpacks, not Docker
- Recommended starting size: `4 vCPU / 8 GB RAM`, `1 replica`
- Do not use multiple replicas while answer media is stored on local disk or a single Railway volume
- Mount the Railway volume at `/app/audio` or set `AUDIO_BASE` to the mounted path

## Backend environment

- `DATABASE_URL` or `SUPABASE_DB_URL`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `HF_TOKEN`
- `DS_TOKEN`
- `CORS_ALLOWED_ORIGINS`
- `APP_ENV=production`
- `ENVIRONMENT=production`
- `WEB_CONCURRENCY=1`
- `UVICORN_LIMIT_CONCURRENCY=2`

## Frontend environment

- `NEXT_PUBLIC_FASTAPI_URL=https://your-railway-backend-domain`
- `NEXT_PUBLIC_FASTAPI_GRAPHQL_URL=https://your-railway-backend-domain/graphql`
- `FASTAPI_URL=https://your-railway-backend-domain`
- `NEXT_PUBLIC_FASTAPI_TIMEOUT_MS=300000`
- `NEXT_PUBLIC_INTERVIEW_VIDEO_BPS=600000`
- `NEXT_PUBLIC_INTERVIEW_AUDIO_BPS=64000`

## Notes

The Next.js `/api/fastapi` proxy remains available as a fallback, but production interview upload and evaluation should use `NEXT_PUBLIC_FASTAPI_URL` directly so recordings do not pass through Vercel functions.
