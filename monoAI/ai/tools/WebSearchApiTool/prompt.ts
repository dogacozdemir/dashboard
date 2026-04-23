import { getLocalMonthYear } from 'src/constants/common.js'

/** Custom search tool (Tavily / Serper); distinct from hosted `WebSearch`. */
export const WEB_SEARCH_API_TOOL_NAME = 'web_search'

export function getWebSearchApiPrompt(): string {
	const currentMonthYear = getLocalMonthYear()
	return `
- Searches the public web via Tavily or Google Serper (server-configured API)
- Use for **any** time-sensitive or external information: current events, office holders, geography, sports, products, academic or market research, fact-checking, and documentation—not limited to programming
- Prefer this tool **before** saying you don't know when the question depends on the live web or post–training-cutoff facts
- Returns titles, snippets, and URLs you can cite or deepen with WebFetch
- Prefer this tool when the hosted WebSearch tool is unavailable or you need API-backed results

After answering, include a **Sources:** section with markdown links [title](url) when citations apply.

Current calendar context: ${currentMonthYear} — use this year in queries about "latest" or "current" topics.

Server configuration: set \`TAVILY_API_KEY\` (preferred) or \`SERPER_API_KEY\` to enable this tool.
`.trim()
}
