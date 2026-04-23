/** Fast in-process PDF generation (no shell). */
export const GENERATE_PDF_TOOL_NAME = 'generate_pdf'

export function getGeneratePdfPrompt(): string {
	return `
- Creates a simple PDF from plain text and saves it under the project working directory
- Supply \`file_path\` as a relative path (e.g. \`reports/notes.pdf\` or \`out.pdf\`); must end with \`.pdf\`
- Supply the full document body as \`text\` (line breaks are preserved; long lines are wrapped)
- **Prefer this over Python, wkhtmltopdf, or Bash heredocs** for basic text PDFs — it is faster and avoids shell subprocesses

Do not use external CLI tools solely to generate simple text PDFs when this tool is available.
`.trim()
}
