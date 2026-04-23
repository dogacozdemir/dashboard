import type React from 'react'
import type { ToolProgressData } from '../../Tool.js'
import { MessageResponse } from '../../components/MessageResponse.js'
import { TOOL_SUMMARY_MAX_LENGTH } from '../../constants/toolLimits.js'
import { Box, Text } from '../../ink.js'
import type { ProgressMessage } from '../../types/message.js'
import { truncate } from '../../utils/format.js'
import type { Output } from './WebSearchApiTool.js'

export function renderToolUseMessage(
	{ query }: Partial<{ query: string }>,
	{ verbose }: { theme?: string; verbose: boolean },
): React.ReactNode {
	if (!query) return null
	return verbose ? `query: "${query}"` : truncate(query, 80)
}

export function renderToolUseProgressMessage(): React.ReactNode {
	return (
		<MessageResponse height={1}>
			<Text dimColor>Searching the web…</Text>
		</MessageResponse>
	)
}

export function renderToolResultMessage(
	{ formatted, provider }: Output,
	_progress: ProgressMessage<ToolProgressData>[],
	{ verbose }: { verbose: boolean },
): React.ReactNode {
	if (verbose) {
		return (
			<Box flexDirection="column">
				<MessageResponse height={1}>
					<Text dimColor>
						{provider} · {formatted.length} chars
					</Text>
				</MessageResponse>
				<Text>{formatted}</Text>
			</Box>
		)
	}
	return (
		<MessageResponse height={1}>
			<Text>Web search ({provider})</Text>
		</MessageResponse>
	)
}

export function getToolUseSummary(input: Partial<{ query: string }> | undefined): string | null {
	if (!input?.query) return null
	return truncate(input.query, TOOL_SUMMARY_MAX_LENGTH)
}
