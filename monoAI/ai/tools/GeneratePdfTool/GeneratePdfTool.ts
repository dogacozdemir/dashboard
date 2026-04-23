import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { cwd } from 'node:process'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { z } from 'zod/v4'
import { type ToolDef, buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
	getToolUseSummary,
	renderToolResultMessage,
	renderToolUseMessage,
	renderToolUseProgressMessage,
} from './UI.js'
import { GENERATE_PDF_TOOL_NAME, getGeneratePdfPrompt } from './prompt.js'

const MAX_CHARS = 500_000
const WRAP_WIDTH = 95
const FONT_SIZE = 11
const LINE_HEIGHT = FONT_SIZE * 1.25
const MARGIN = 50

const inputSchema = lazySchema(() =>
	z.strictObject({
		file_path: z
			.string()
			.min(1)
			.describe('Relative path under the project cwd; must end with .pdf (e.g. docs/report.pdf)'),
		text: z.string().describe('Plain-text body of the PDF; line breaks preserved'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		file_path: z.string(),
		sizeBytes: z.number(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

function resolveSafeOutputPath(file_path: string): string {
	const trimmed = file_path.trim()
	const root = resolve(cwd())
	const out = resolve(root, trimmed)
	const rootPref = root.endsWith(sep) ? root : `${root}${sep}`
	if (out !== root && !out.startsWith(rootPref)) {
		throw new Error('Output path must stay within the working directory')
	}
	return out
}

function flattenLines(body: string): string[] {
	const lines: string[] = []
	for (const para of body.split(/\r?\n/)) {
		if (para.length <= WRAP_WIDTH) {
			lines.push(para)
			continue
		}
		for (let i = 0; i < para.length; i += WRAP_WIDTH) {
			lines.push(para.slice(i, i + WRAP_WIDTH))
		}
	}
	return lines
}

async function buildPdfBytes(body: string): Promise<Uint8Array> {
	const pdfDoc = await PDFDocument.create()
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
	const flatLines = flattenLines(body)

	let page = pdfDoc.addPage()
	let { height } = page.getSize()
	let y = height - MARGIN

	for (const line of flatLines) {
		if (y < MARGIN) {
			page = pdfDoc.addPage()
			;({ height } = page.getSize())
			y = height - MARGIN
		}
		page.drawText(line, {
			x: MARGIN,
			y,
			size: FONT_SIZE,
			font,
			color: rgb(0, 0, 0),
		})
		y -= LINE_HEIGHT
	}

	return pdfDoc.save()
}

export const GeneratePdfTool = buildTool({
	name: GENERATE_PDF_TOOL_NAME,
	searchHint: 'create a simple PDF file from plain text in the project directory',
	maxResultSizeChars: 50_000,
	shouldDefer: true,
	alwaysLoad: true,
	async description(input) {
		return `Generate PDF at ${input.file_path}`
	},
	userFacingName() {
		return 'Generate PDF'
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
		return false
	},
	toAutoClassifierInput(input) {
		return input.file_path
	},
	async checkPermissions(input) {
		return { behavior: 'allow', updatedInput: input }
	},
	async prompt() {
		return getGeneratePdfPrompt()
	},
	renderToolUseMessage,
	renderToolUseProgressMessage,
	renderToolResultMessage,
	async validateInput(input) {
		const fp = input.file_path?.trim() ?? ''
		if (!fp) {
			return { result: false, message: 'file_path is required', errorCode: 1 }
		}
		if (!fp.toLowerCase().endsWith('.pdf')) {
			return {
				result: false,
				message: 'file_path must end with .pdf',
				errorCode: 2,
			}
		}
		if ((input.text?.length ?? 0) > MAX_CHARS) {
			return {
				result: false,
				message: `text exceeds ${MAX_CHARS} characters`,
				errorCode: 3,
			}
		}
		try {
			resolveSafeOutputPath(fp)
		} catch (e) {
			return {
				result: false,
				message: e instanceof Error ? e.message : String(e),
				errorCode: 4,
			}
		}
		return { result: true }
	},
	async call(input, _context) {
		const absPath = resolveSafeOutputPath(input.file_path)
		mkdirSync(dirname(absPath), { recursive: true })
		const bytes = await buildPdfBytes(input.text ?? '')
		writeFileSync(absPath, bytes)
		const data: Output = {
			file_path: input.file_path.trim(),
			sizeBytes: bytes.byteLength,
		}
		return { data }
	},
	mapToolResultToToolResultBlockParam(output, toolUseID) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: `Wrote PDF (${output.sizeBytes} bytes) to \`${output.file_path}\`.`,
		}
	},
	getToolUseSummary,
} satisfies ToolDef<InputSchema, Output>)
