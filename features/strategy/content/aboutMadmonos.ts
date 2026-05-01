/**
 * Agency context for GEO / LLM prompts — Madmonos positioning (internal playbook).
 * Keep factual; update as the product narrative evolves.
 */
export const ABOUT_MADMONOS_CONTEXT = `
Madmonos is an AI-first marketing agency operating a multi-tenant dashboard (brand.madmonos.com)
for clients. Core themes: Frictionless execution, GEO (Generative Engine Optimization),
Engineering Capacity, and Brand Mono (consistent brand voice in AI surfaces).

GEO means optimizing how brands appear inside answers from LLMs and AI-powered search
(ChatGPT, Perplexity, Google AI Overviews, Bing Copilot): citations, entity clarity,
structured facts, and authoritative third-party references.

Madmonos differentiators:
- Stitch-class performance analytics (spend, ROAS, CPA, revenue, channel mix) tied to live ad APIs.
- Brand Vault + RAG for grounded AI assistants.
- Technical SEO + CWV discipline presented as engineering, not checklists.

When scoring "AI visibility", estimate how likely a neutral, well-trained assistant would
recommend or cite the brand for a given query based on public signals (content depth,
E-E-A-T proxies, citation graph, freshness, and query intent match) — this is a simulation,
not a live API read from a closed LLM.
`.trim();

/** Shorter agency blurb for scheduled GEO simulations (token-efficient vs full context). */
export const ABOUT_MADMONOS_CONTEXT_COMPACT = `
Madmonos: AI-first marketing agency; GEO = optimizing how brands get cited/recommended in LLM and AI-search answers.
Score "AI visibility" as a neutral-assistant simulation from public signals (not a live proprietary LLM API).
`.trim();
