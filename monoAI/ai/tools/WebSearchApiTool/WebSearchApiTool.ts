import { z } from 'zod/v4'
import { type ToolDef, buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logError } from '../../utils/log.js'
import type { PermissionResult } from '../../utils/permissions/PermissionResult.js'
import {
	getToolUseSummary,
	renderToolResultMessage,
	renderToolUseMessage,
	renderToolUseProgressMessage,
} from './UI.js'
import { WEB_SEARCH_API_TOOL_NAME, getWebSearchApiPrompt } from './prompt.js'

const inputSchema = lazySchema(() =>
	z.strictObject({
		query: z.string().min(2).describe('Web search query'),
		max_results: z
			.number()
			.int()
			.min(1)
			.max(15)
			.optional()
			.describe('Maximum results to return (default 8)'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		query: z.string(),
		provider: z.enum(['tavily', 'serper']),
		formatted: z.string(),
		durationMs: z.number(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

type TavilyResult = {
	title?: string
	url?: string
	content?: string
}

type SerperOrganic = {
	title?: string
	link?: string
	snippet?: string
}

function pickProvider(): 'tavily' | 'serper' | null {
	if (process.env.TAVILY_API_KEY?.trim()) return 'tavily'
	if (process.env.SERPER_API_KEY?.trim()) return 'serper'
	return null
}

/** True when Tavily or Serper is configured — matches {@link WebSearchApiTool.isEnabled} and `getTools()` filtering. Keys are read from `process.env` at runtime (CLI/API must load `.env` before first prompt). */
export function isWebSearchApiConfigured(): boolean {
	return pickProvider() !== null
}

async function searchTavily(
	query: string,
	maxResults: number,
	signal: AbortSignal,
): Promise<string> {
	const key = process.env.TAVILY_API_KEY!.trim()
	const res = await fetch('https://api.tavily.com/search', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			api_key: key,
			query,
			max_results: maxResults,
			search_depth: 'basic',
			include_answer: true,
		}),
		signal,
	})
	if (!res.ok) {
		const t = await res.text().catch(() => res.statusText)
		throw new Error(`Tavily error ${res.status}: ${t.slice(0, 400)}`)
	}
	const data = (await res.json()) as {
		answer?: string
		results?: TavilyResult[]
	}
	const lines: string[] = []
	if (data.answer) lines.push(`Summary: ${data.answer}\n`)
	lines.push('Results:')
	for (const r of data.results ?? []) {
		const title = r.title ?? '(no title)'
		const url = r.url ?? ''
		const snip = r.content
			? ` — ${r.content.slice(0, 500)}${r.content.length > 500 ? '…' : ''}`
			: ''
		lines.push(`- [${title}](${url})${snip}`)
	}
	return lines.join('\n')
}

async function searchSerper(
	query: string,
	maxResults: number,
	signal: AbortSignal,
): Promise<string> {
	const key = process.env.SERPER_API_KEY!.trim()
	const res = await fetch('https://google.serper.dev/search', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-API-KEY': key,
		},
		body: JSON.stringify({ q: query, num: maxResults }),
		signal,
	})
	if (!res.ok) {
		const t = await res.text().catch(() => res.statusText)
		throw new Error(`Serper error ${res.status}: ${t.slice(0, 400)}`)
	}
	const data = (await res.json()) as {
		answerBox?: { answer?: string }
		organic?: SerperOrganic[]
	}
	const lines: string[] = []
	if (data.answerBox?.answer) lines.push(`Answer box: ${data.answerBox.answer}\n`)
	lines.push('Results:')
	for (const r of data.organic ?? []) {
		const title = r.title ?? '(no title)'
		const url = r.link ?? ''
		const snip = r.snippet
			? ` — ${r.snippet.slice(0, 500)}${r.snippet.length > 500 ? '…' : ''}`
			: ''
		lines.push(`- [${title}](${url})${snip}`)
	}
	return lines.join('\n')
}

export const WebSearchApiTool = buildTool({
	name: WEB_SEARCH_API_TOOL_NAME,
	searchHint:
		'web search for current facts, news, public figures, markets, docs, and research—not only coding',
	maxResultSizeChars: 100_000,
	shouldDefer: true,
	alwaysLoad: true,
	async description(input) {
		return `Web search (general research / current facts): ${input.query}`
	},
	userFacingName() {
		return 'Web search (API)'
	},
	getToolUseSummary,
	getActivityDescription(input) {
		const s = getToolUseSummary(input)
		return s ? `Searching: ${s}` : 'Web search'
	},
	isEnabled() {
		return pickProvider() !== null
	},
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	get outputSchema(): OutputSchema {
		return outputSchema()
	},
	isConcurrencySafe() {
		return true
	},
	isReadOnly() {
		return true
	},
	toAutoClassifierInput(input) {
		return input.query
	},
	async checkPermissions(): Promise<PermissionResult> {
		return {
			behavior: 'passthrough',
			message: 'web_search requires permission.',
			suggestions: [
				{
					type: 'addRules',
					rules: [{ toolName: WEB_SEARCH_API_TOOL_NAME }],
					behavior: 'allow',
					destination: 'localSettings',
				},
			],
		}
	},
	async prompt() {
		return getWebSearchApiPrompt()
	},
	renderToolUseMessage,
	renderToolUseProgressMessage,
	renderToolResultMessage,
	extractSearchText(out) {
		return out.formatted
	},
	async validateInput(input) {
		if (!input.query?.trim()) {
			return { result: false, message: 'Missing query', errorCode: 1 }
		}
		if (!pickProvider()) {
			return {
				result: false,
				message:
					'web_search is not configured. Set TAVILY_API_KEY or SERPER_API_KEY in the server environment.',
				errorCode: 2,
			}
		}
		return { result: true }
	},
	async call(input, context) {
		const start = Date.now()
		const provider = pickProvider()
		if (!provider) {
			throw new Error('web_search: no API key configured')
		}
		const max = input.max_results ?? 8
		const signal = context.abortController.signal
		let formatted: string
		try {
			formatted =
				provider === 'tavily'
					? await searchTavily(input.query, max, signal)
					: await searchSerper(input.query, max, signal)
		} catch (e) {
			logError(e instanceof Error ? e : new Error(String(e)))
			throw e
		}
		const output: Output = {
			query: input.query,
			provider,
			formatted,
			durationMs: Date.now() - start,
		}
		return { data: output }
	},
	mapToolResultToToolResultBlockParam(output, toolUseID) {
		const body = `${output.formatted}\n\n_REMINDER: Cite sources with markdown links where relevant._`
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: body,
		}
	},
} satisfies ToolDef<InputSchema, Output>)
