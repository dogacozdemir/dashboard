# monoAI Capability Migration Playbook

This folder is a staged extraction from `claude-code-main` to accelerate capability transfer into your existing monoAI chatbot.

## What is included

- `ai/tools/Tool.ts`: core tool interface and build contract.
- `ai/tools/tools.registry.ts`: canonical tool registry and pool assembly logic.
- `ai/execution/toolExecution.ts`: validation, permission decision, hook + execution pipeline.
- `ai/permissions/`: permission rule system and supporting policy logic.
- `ai/model/`: model normalization and provider mapping.
- `ai/api/`: provider client orchestration and runtime API calls.
- `ai/mcp/`: MCP client lifecycle, config, and server integration plumbing.
- `ai/prompts/`: source prompt-composition files from this repo.
- `ai/tools/*Tool*/`: selected production-capable tools for chatbot utility.

## Target architecture in your other project

- `ai/core/`
  - `query-engine.ts`
  - `model-adapter.ts`
  - `turn-orchestrator.ts`
- `ai/tools/`
  - `Tool.ts`
  - `tools.registry.ts`
  - `GeneratePdfTool/`
  - `FileReadTool/`
  - `FileWriteTool/`
  - `FileEditTool/`
  - `GlobTool/`
  - `GrepTool/`
  - `WebFetchTool/`
  - `WebSearchApiTool/`
  - `MCPTool/`
  - `ListMcpResourcesTool/`
  - `ReadMcpResourceTool/`
- `ai/execution/`
  - `toolExecution.ts`
- `ai/permissions/`
  - permission mode and rules
- `ai/mcp/`
  - MCP transport, auth, and config
- `ai/prompts/`
  - brand-safe monoAI prompts only

## Critical integration notes

1. Do not copy product persona text from source prompts directly. Re-author for monoAI.
2. Keep input validation and output bounding fully enabled for all tools.
3. If you do not need interactive approvals, keep "ask" paths disabled at runtime and use allow-mode in bot context.
4. Preserve path safety checks and cwd boundary protection in write-oriented tools.
5. Wire tenant security at the outer application layer, then feed resulting permission context into tool runtime.

## Deployment order (recommended)

1. Integrate `Tool.ts` + `toolExecution.ts` + registry.
2. Enable `GeneratePdfTool` and read/write tools.
3. Add web fetch/search tools.
4. Add MCP tools and server connections.
5. Replace prompt composer with monoAI-safe prompt pack.
6. Add observability and error reporting.
7. Roll out by tenant in stages.
