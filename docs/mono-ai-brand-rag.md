# Mono AI + Brand Vault RAG

## Overview

- **Tenant knowledge:** PDFs (and plain text) uploaded to Brand Vault are chunked, embedded with local **gte-small** (384 dimensions via `@xenova/transformers`), and stored in Postgres **pgvector** (`brand_knowledge_chunks`).
- **External crawl:** Mono AI `crawl_url` tool stores competitor/page text in `external_knowledge_chunks` using the same embedding pipeline.
- **Agency knowledge:** Questions about **Madmonos the agency** are answered from the system prompt playbook, not from the client’s vault.
- **Retrieval:** Mono AI (`features/ai-chat`) runs similarity search via RPC `match_brand_knowledge_chunks` when user intent matches tenant-brand patterns (`features/ai-chat/lib/brandRagIntent.ts`).

## Embeddings provider

DeepSeek’s public API documents chat models only — there is no supported `/embeddings` endpoint. The app defaults to **local gte-small** (aligned with Supabase’s recommended on-device model).

| Variable | Default | Purpose |
|----------|---------|---------|
| `EMBEDDING_PROVIDER` | `auto` | `local` \| `deepseek` \| `auto` — `auto` tries DeepSeek when `DEEPSEEK_API_KEY` is set, then falls back to local |
| `DEEPSEEK_API_KEY` | — | Used for Mono AI chat; optional embedding attempt when provider is `auto` or `deepseek` |
| `DEEPSEEK_EMBEDDING_MODEL` | `deepseek-embedding` | Model name if DeepSeek adds embeddings later |

**No `OPENAI_API_KEY` is required** for Brand Vault RAG or DeepMarka crawl vectors.

## Setup

1. Apply migrations (in order):

   - `supabase/migrations/20260428120000_brand_knowledge_rag.sql`
   - `supabase/migrations/20260509140000_embeddings_gte_small_384.sql` — migrates `vector(1536)` → `vector(384)` and **truncates existing chunks** (re-index required)

   On hosted Supabase: ensure the **vector** extension is enabled (Dashboard → Database → Extensions).

2. Environment variables:

   - `SUPABASE_SERVICE_ROLE_KEY` — recommended for **background** indexing after upload (`after()` in `app/api/assets/brand/route.ts`). If omitted, indexing runs **inline** in the upload request using the user’s Supabase session.
   - Optional: `EMBEDDING_PROVIDER=local` to skip any DeepSeek embedding attempt.

3. Redeploy the app. First embedding call downloads the gte-small model (~30 MB); allow sufficient server memory on cold start.

## Operations

- **Re-index after migration:** Re-upload Brand Vault files or trigger `indexBrandAsset` for each asset. Re-run `crawl_url` with `persist: true` for external URLs.
- **Status:** `brand_assets.indexing_status` is one of `pending | ready | failed | skipped`. Fonts and non-text assets are `skipped`.
- **Limits:** Indexing refuses files larger than 15 MB (see `indexBrandAsset.ts`).

## Security

- Row Level Security on `brand_knowledge_chunks` mirrors tenant isolation on `brand_assets`.
- `match_brand_knowledge_chunks` is `SECURITY DEFINER` and checks that `auth.uid()` belongs to `p_tenant_id` before returning rows.
