# Mono AI + Brand Vault RAG

## Overview

- **Tenant knowledge:** PDFs (and plain text) uploaded to Brand Vault are chunked, embedded with OpenAI `text-embedding-3-small` (1536 dimensions), and stored in Postgres **pgvector** (`brand_knowledge_chunks`).
- **Agency knowledge:** Questions about **Madmonos the agency** are answered from the system prompt playbook, not from the client’s vault.
- **Retrieval:** Mono AI (`features/ai-chat`) runs similarity search via RPC `match_brand_knowledge_chunks` when user intent matches tenant-brand patterns (`features/ai-chat/lib/brandRagIntent.ts`).

## Setup

1. Apply the migration:

   `supabase/migrations/20260428120000_brand_knowledge_rag.sql`

   On hosted Supabase: ensure the **vector** extension is enabled (Dashboard → Database → Extensions).

2. Set environment variables (see [`.env.example`](../.env.example)):

   - `OPENAI_API_KEY` — required for embeddings and RAG.
   - `SUPABASE_SERVICE_ROLE_KEY` — recommended for **background** indexing after upload (`after()` in `app/api/assets/brand/route.ts`). If omitted, indexing runs **inline** in the upload request using the user’s Supabase session.

3. Redeploy the app so the new API route and server actions are live.

## Operations

- **Re-index:** Re-upload the file or add an admin action that calls `indexBrandAsset` from `features/brand-vault/lib/indexBrandAsset.ts`.
- **Status:** `brand_assets.indexing_status` is one of `pending | ready | failed | skipped`. Fonts and non-text assets are `skipped`.
- **Limits:** Indexing refuses files larger than 15 MB (see `indexBrandAsset.ts`).

## Security

- Row Level Security on `brand_knowledge_chunks` mirrors tenant isolation on `brand_assets`.
- `match_brand_knowledge_chunks` is `SECURITY DEFINER` and checks that `auth.uid()` belongs to `p_tenant_id` before returning rows.
