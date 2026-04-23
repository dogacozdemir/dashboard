import type React from 'react'
import type { ToolProgressData } from '../../Tool.js'
import { MessageResponse } from '../../components/MessageResponse.js'
import { TOOL_SUMMARY_MAX_LENGTH } from '../../constants/toolLimits.js'
import { Box, Text } from '../../ink.js'
import type { ProgressMessage } from '../../types/message.js'
import { truncate } from '../../utils/format.js'
import type { Output } from './GeneratePdfTool.js'

export function renderToolUseMessage(
	{ file_path }: Partial<{ file_path: string }>,
	{ verbose }: { theme?: string; verbose: boolean },
): React.ReactNode {
	if (!file_path) return null
	return verbose ? `→ ${file_path}` : truncate(file_path, 80)
}

export function renderToolUseProgressMessage(): React.ReactNode {
	return (
		<MessageResponse height={1}>
			<Text dimColor>Generating PDF…</Text>
		</MessageResponse>
	)
}

export function renderToolResultMessage(
	{ file_path, sizeBytes }: Output,
	_progress: ProgressMessage<ToolProgressData>[],
	{ verbose }: { verbose: boolean },
): React.ReactNode {
	if (verbose) {
		return (
			<Box flexDirection="column">
				<MessageResponse height={1}>
					<Text dimColor>
						{file_path} · {sizeBytes} bytes
					</Text>
				</MessageResponse>
			</Box>
		)
	}
	return (
		<MessageResponse height={1}>
			<Text>PDF saved: {file_path}</Text>
		</MessageResponse>
	)
}

export function getToolUseSummary(
	input: Partial<{ file_path: string }> | undefined,
): string | null {
	if (!input?.file_path) return null
	return truncate(input.file_path, TOOL_SUMMARY_MAX_LENGTH)
}
