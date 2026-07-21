import 'server-only';

import { readFile } from 'fs/promises';
import path from 'path';
import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';

/**
 * Unicode-capable fonts for generated PDFs.
 *
 * pdf-lib's StandardFonts (Helvetica) use WinAnsi, which cannot encode Turkish
 * ı/İ/ş/ğ — the old code folded them to ASCII ("Yönetici özeti" → "Yonetici ozeti").
 * Embedding a real TTF fixes that, so reports render proper Turkish.
 *
 * Liberation Sans (SIL OFL) ships both weights and covers Latin + Turkish fully.
 */

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');

let cachedRegular: Buffer | null = null;
let cachedBold: Buffer | null = null;
let cachedItalic: Buffer | null = null;

async function loadBytes(file: string): Promise<Buffer> {
  return readFile(path.join(FONT_DIR, file));
}

export interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

/**
 * Registers fontkit and embeds the Unicode fonts into the document.
 * Falls back to `null` if the font files are unavailable, so callers can degrade
 * to StandardFonts rather than failing the whole export.
 */
export async function embedUnicodeFonts(doc: PDFDocument): Promise<PdfFonts | null> {
  try {
    doc.registerFontkit(fontkit);
    if (!cachedRegular) cachedRegular = await loadBytes('LiberationSans-Regular.ttf');
    if (!cachedBold) cachedBold = await loadBytes('LiberationSans-Bold.ttf');
    if (!cachedItalic) cachedItalic = await loadBytes('LiberationSans-Italic.ttf');

    const [regular, bold, italic] = await Promise.all([
      doc.embedFont(cachedRegular, { subset: true }),
      doc.embedFont(cachedBold, { subset: true }),
      doc.embedFont(cachedItalic, { subset: true }),
    ]);
    return { regular, bold, italic };
  } catch (e) {
    console.error('[pdf-fonts] Unicode font embed failed, falling back:', e);
    return null;
  }
}
