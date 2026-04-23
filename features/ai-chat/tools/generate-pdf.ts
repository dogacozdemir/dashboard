/**
 * generate-pdf.ts
 *
 * Server-side PDF generation using pdf-lib.
 * Stores result in AWS S3 at: {tenantId}/AI/{timestamp}_{filename}
 * Returns a 1-hour pre-signed download URL.
 *
 * Design language: Madmonos "Engineering Dark" — navy header, indigo accents,
 * clean typography, section callouts, and a branded footer.
 */

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { buildS3Key, putS3Object, createPresignedDownloadUrl } from '@/lib/storage/s3';

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const C = {
  headerBg:    rgb(0.039, 0.055, 0.102),   // #0A0E1A  deep navy
  headerText:  rgb(1,     1,     1),        // #FFFFFF
  headerSub:   rgb(0.600, 0.671, 0.776),   // #99ABBF  muted
  accentBar:   rgb(0.388, 0.400, 0.945),   // #6366F1  indigo
  accentTeal:  rgb(0.039, 0.769, 0.627),   // #0AC4A0  teal
  sectionBg:   rgb(0.953, 0.965, 0.988),   // #F3F6FC  very light blue
  calloutBg:   rgb(0.933, 0.941, 0.996),   // #EEF0FE  indigo tint
  calloutBdr:  rgb(0.388, 0.400, 0.945),   // indigo
  white:       rgb(1,     1,     1),
  textDark:    rgb(0.082, 0.118, 0.176),   // #151E2D
  textMid:     rgb(0.337, 0.392, 0.463),   // #566376
  textLight:   rgb(0.561, 0.612, 0.675),   // #8F9CAC
  border:      rgb(0.859, 0.886, 0.918),   // #DBE2EB
  bullet:      rgb(0.388, 0.400, 0.945),   // indigo dot
  footerBg:    rgb(0.063, 0.082, 0.118),   // #101523
  footerText:  rgb(0.561, 0.612, 0.675),   // muted
  h1Accent:    rgb(0.039, 0.769, 0.627),   // teal line under H1
  h2Accent:    rgb(0.388, 0.400, 0.945),   // indigo line under H2
};

const PAGE_W  = 595;   // A4 width  (points)
const PAGE_H  = 842;   // A4 height (points)
const MARGIN  = 52;
const CONTENT_W = PAGE_W - MARGIN * 2;

const HEADER_H  = 160;   // cover header height
const FOOTER_H  = 28;
const BODY_TOP  = PAGE_H - HEADER_H - 24;
const BODY_BTM  = FOOTER_H + 16;

const F = {
  h1:      22,
  h2:      15,
  h3:      12.5,
  body:    10.5,
  small:   9,
  caption: 8.5,
};

// ─── SANITIZER ───────────────────────────────────────────────────────────────

function toWinAnsi(text: string): string {
  return text
    .replace(/[\u2018\u2019\u0060]/g,  "'")
    .replace(/[\u201C\u201D]/g,         '"')
    .replace(/[\u2013\u2014]/g,         '-')
    .replace(/\u2026/g,                 '...')
    .replace(/[\uFF5C\u007C]/g,         '|')
    .replace(/\u2022/g,                 '*')
    .replace(/[\u2192\u2794]/g,         '->')
    .replace(/[^\x20-\xFF\n\r\t]/g,    '');
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Ctx {
  doc:      PDFDocument;
  regular:  PDFFont;
  bold:     PDFFont;
  oblique:  PDFFont;
  pages:    PDFPage[];
  page:     PDFPage;
  y:        number;
  pageNum:  number;
}

// ─── PAGE MANAGEMENT ─────────────────────────────────────────────────────────

function newPage(ctx: Ctx): void {
  ctx.pageNum++;
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pages.push(ctx.page);
  ctx.y = PAGE_H - MARGIN;

  // Subtle top stripe on continuation pages
  ctx.page.drawRectangle({
    x: 0, y: PAGE_H - 8,
    width: PAGE_W, height: 8,
    color: C.accentBar,
  });

  ctx.y = PAGE_H - 8 - MARGIN;
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < BODY_BTM) {
    drawFooter(ctx);
    newPage(ctx);
  }
}

// ─── FOOTER ──────────────────────────────────────────────────────────────────

function drawFooter(ctx: Ctx): void {
  const p = ctx.page;
  p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: FOOTER_H, color: C.footerBg });
  p.drawRectangle({ x: 0, y: FOOTER_H - 1.5, width: PAGE_W, height: 1.5, color: C.accentBar });

  p.drawText('Powered by monoAI v1  |  Madmonos', {
    x: MARGIN, y: 9,
    size: F.caption, font: ctx.regular, color: C.footerText,
  });
  p.drawText(`${ctx.pageNum}`, {
    x: PAGE_W - MARGIN - 10, y: 9,
    size: F.caption, font: ctx.bold, color: C.footerText,
  });
}

// ─── COVER HEADER ────────────────────────────────────────────────────────────

function drawCoverHeader(ctx: Ctx, title: string): void {
  const p = ctx.page;

  // Background
  p.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: C.headerBg });

  // Left indigo accent stripe
  p.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: 5, height: HEADER_H, color: C.accentBar });

  // monoAI badge (top-right)
  const badge = 'monoAI v1';
  p.drawText(badge, {
    x: PAGE_W - MARGIN - ctx.bold.widthOfTextAtSize(badge, F.small),
    y: PAGE_H - 26,
    size: F.small, font: ctx.bold, color: C.accentTeal,
  });

  // Title (wrap if long)
  const titleClean  = toWinAnsi(title);
  const maxTitleW   = CONTENT_W - 20;
  const titleSize   = titleClean.length > 55 ? F.h1 - 4 : F.h1;
  const words       = titleClean.split(' ');
  const titleLines: string[] = [];
  let   cur         = '';

  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.bold.widthOfTextAtSize(test, titleSize) > maxTitleW) {
      if (cur) titleLines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) titleLines.push(cur);

  const lineH = titleSize * 1.35;
  const blockH = titleLines.length * lineH;
  let ty = PAGE_H - HEADER_H / 2 + blockH / 2 - 8;

  for (const tl of titleLines) {
    p.drawText(tl, { x: MARGIN + 14, y: ty, size: titleSize, font: ctx.bold, color: C.headerText });
    ty -= lineH;
  }

  // Date + generated-by line
  const date = new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
  p.drawText(`${date}  |  AI-Generated Report`, {
    x: MARGIN + 14, y: PAGE_H - HEADER_H + 22,
    size: F.small, font: ctx.regular, color: C.headerSub,
  });
}

// ─── TEXT HELPERS ─────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return toWinAnsi(text)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g,     '$1')
    .replace(/`(.+?)`/g,       '$1')
    .replace(/^\s*[-*+]\s+/,   '')
    .replace(/^\s*\d+\.\s+/,   '');
}

/** Split text into lines that fit within maxWidth pixels at given font size. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text.trim()) return [''];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';

  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (cur) lines.push(cur);
      // If a single word is too wide, split it
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let chunk = '';
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        cur = chunk;
      } else {
        cur = w;
      }
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// ─── BLOCK RENDERERS ─────────────────────────────────────────────────────────

function drawH1(ctx: Ctx, text: string): void {
  const clean = toWinAnsi(text.replace(/^#+\s+/, '').replace(/\*\*/g, ''));
  ensureSpace(ctx, F.h1 * 3.2);

  ctx.y -= 6;
  ctx.page.drawText(clean, { x: MARGIN, y: ctx.y, size: F.h1, font: ctx.bold, color: C.textDark });
  ctx.y -= F.h1 * 0.5 + 4;
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y, width: 48, height: 3, color: C.h1Accent });
  ctx.y -= 14;
}

function drawH2(ctx: Ctx, text: string): void {
  const clean = toWinAnsi(text.replace(/^#+\s+/, '').replace(/\*\*/g, ''));
  ensureSpace(ctx, F.h2 * 3.2);

  ctx.y -= 10;
  // Colored left bar
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - F.h2 * 0.8, width: 3.5, height: F.h2 * 1.4, color: C.accentBar });
  ctx.page.drawText(clean, {
    x: MARGIN + 10, y: ctx.y,
    size: F.h2, font: ctx.bold, color: C.textDark,
  });
  ctx.y -= F.h2 * 1.6;
}

function drawH3(ctx: Ctx, text: string): void {
  const clean = toWinAnsi(text.replace(/^#+\s+/, '').replace(/\*\*/g, ''));
  ensureSpace(ctx, F.h3 * 2.8);

  ctx.y -= 7;
  ctx.page.drawText(clean, {
    x: MARGIN, y: ctx.y,
    size: F.h3, font: ctx.bold, color: C.accentBar,
  });
  ctx.y -= F.h3 * 1.55;
}

function drawBody(ctx: Ctx, text: string, indent = 0): void {
  const clean   = stripMarkdown(text);
  const maxW    = CONTENT_W - indent;
  const wrapped = wrapText(clean, ctx.regular, F.body, maxW);
  const lh      = F.body * 1.55;

  for (const line of wrapped) {
    ensureSpace(ctx, lh + 2);
    if (line.trim()) {
      ctx.page.drawText(line, {
        x: MARGIN + indent, y: ctx.y,
        size: F.body, font: ctx.regular, color: C.textDark,
      });
    }
    ctx.y -= lh;
  }
}

function drawBullet(ctx: Ctx, text: string, level = 0): void {
  const indent  = level * 14;
  const bulletX = MARGIN + indent;
  const textX   = bulletX + 12;
  const maxW    = CONTENT_W - indent - 14;
  const clean   = stripMarkdown(text.replace(/^[\s\-*+]+/, '').replace(/^\d+\.\s+/, ''));
  const wrapped = wrapText(clean, ctx.regular, F.body, maxW);
  const lh      = F.body * 1.55;

  ensureSpace(ctx, lh * wrapped.length + 2);

  // Bullet dot
  ctx.page.drawCircle({ x: bulletX + 3, y: ctx.y + F.body * 0.35, size: 2.2, color: C.bullet });

  for (let i = 0; i < wrapped.length; i++) {
    if (i > 0) ensureSpace(ctx, lh + 2);
    if (wrapped[i].trim()) {
      ctx.page.drawText(wrapped[i], {
        x: textX, y: ctx.y,
        size: F.body, font: ctx.regular, color: C.textDark,
      });
    }
    ctx.y -= lh;
  }
}

function drawCallout(ctx: Ctx, text: string): void {
  const clean   = stripMarkdown(text.replace(/^>\s*/, ''));
  const maxW    = CONTENT_W - 24;
  const wrapped = wrapText(clean, ctx.regular, F.body, maxW);
  const boxH    = wrapped.length * F.body * 1.55 + 20;

  ensureSpace(ctx, boxH + 12);
  ctx.y -= 6;

  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y - boxH + 8,
    width: CONTENT_W, height: boxH,
    color: C.calloutBg,
  });
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y - boxH + 8,
    width: 3.5, height: boxH,
    color: C.calloutBdr,
  });

  ctx.y -= 10;
  for (const line of wrapped) {
    if (line.trim()) {
      ctx.page.drawText(line, {
        x: MARGIN + 14, y: ctx.y,
        size: F.body, font: ctx.oblique, color: C.textDark,
      });
    }
    ctx.y -= F.body * 1.55;
  }
  ctx.y -= 8;
}

function drawDivider(ctx: Ctx): void {
  ensureSpace(ctx, 20);
  ctx.y -= 8;
  ctx.page.drawLine({
    start: { x: MARGIN,           y: ctx.y },
    end:   { x: PAGE_W - MARGIN,  y: ctx.y },
    thickness: 0.5, color: C.border,
  });
  ctx.y -= 12;
}

function drawSectionTag(ctx: Ctx, tag: string): void {
  const clean  = toWinAnsi(tag);
  const tagW   = ctx.bold.widthOfTextAtSize(clean, F.caption) + 16;
  const tagH   = F.caption + 10;

  ensureSpace(ctx, tagH + 10);
  ctx.y -= 6;

  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - tagH + F.caption + 1, width: tagW, height: tagH, color: C.accentBar });
  ctx.page.drawText(clean, { x: MARGIN + 8, y: ctx.y - 2, size: F.caption, font: ctx.bold, color: C.white });

  ctx.y -= tagH + 6;
}

// ─── MARKDOWN PARSER ──────────────────────────────────────────────────────────

type BlockType = 'h1' | 'h2' | 'h3' | 'bullet' | 'bullet2' | 'callout' | 'divider' | 'tag' | 'body' | 'blank';

interface Block {
  type: BlockType;
  text: string;
}

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      blocks.push({ type: 'blank', text: '' });
    } else if (/^# /.test(line)) {
      blocks.push({ type: 'h1', text: line });
    } else if (/^## /.test(line)) {
      blocks.push({ type: 'h2', text: line });
    } else if (/^### /.test(line)) {
      blocks.push({ type: 'h3', text: line });
    } else if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'divider', text: '' });
    } else if (/^>\s/.test(line)) {
      blocks.push({ type: 'callout', text: line });
    } else if (/^\s{4,}[-*+]\s/.test(line) || /^\s+\d+\.\s/.test(line)) {
      blocks.push({ type: 'bullet2', text: line });
    } else if (/^[-*+]\s/.test(line) || /^\d+\.\s/.test(line)) {
      blocks.push({ type: 'bullet', text: line });
    } else if (/^\[.*\]$/.test(line.trim())) {
      // [Section Tag] style labels
      blocks.push({ type: 'tag', text: line.trim().replace(/^\[|\]$/g, '') });
    } else {
      blocks.push({ type: 'body', text: line });
    }
  }
  return blocks;
}

// ─── MAIN BUILDER ────────────────────────────────────────────────────────────

async function buildPdfBytes(title: string, body: string): Promise<Uint8Array> {
  const doc      = await PDFDocument.create();
  doc.setTitle(toWinAnsi(title));
  doc.setProducer('monoAI v1 — Madmonos');
  doc.setCreationDate(new Date());

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const firstPage = doc.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = {
    doc, regular, bold, oblique,
    pages:   [firstPage],
    page:    firstPage,
    y:       PAGE_H - HEADER_H - 24,
    pageNum: 1,
  };

  // Cover header on page 1
  drawCoverHeader(ctx, title);

  // Render content blocks
  const blocks = parseBlocks(toWinAnsi(body).slice(0, 300_000));
  let blankRun  = 0;

  for (const block of blocks) {
    if (block.type === 'blank') {
      blankRun++;
      if (blankRun <= 1) ctx.y -= 4;
      continue;
    }
    blankRun = 0;

    switch (block.type) {
      case 'h1':      drawH1(ctx, block.text);          break;
      case 'h2':      drawH2(ctx, block.text);          break;
      case 'h3':      drawH3(ctx, block.text);          break;
      case 'bullet':  drawBullet(ctx, block.text, 0);   break;
      case 'bullet2': drawBullet(ctx, block.text, 1);   break;
      case 'callout': drawCallout(ctx, block.text);     break;
      case 'divider': drawDivider(ctx);                 break;
      case 'tag':     drawSectionTag(ctx, block.text);  break;
      default:        drawBody(ctx, block.text);        break;
    }
  }

  // Footer on every page
  for (const pg of ctx.pages) {
    ctx.page = pg;
    drawFooter(ctx);
  }

  return doc.save();
}

// ─── TYPES + PUBLIC API ───────────────────────────────────────────────────────

export interface GeneratePdfOptions {
  filename: string;
  title:    string;
  content:  string;
}

export interface GeneratePdfResult {
  downloadUrl: string;
  s3Key:       string;
  sizeBytes:   number;
}

export async function generateAndStorePdf(
  options:  GeneratePdfOptions,
  tenantId: string,
): Promise<GeneratePdfResult> {
  const { title, content, filename } = options;

  const safeName  = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const finalName = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;

  const bytes = await buildPdfBytes(title, content);

  const s3Key = buildS3Key(tenantId, 'AI', finalName);

  await putS3Object({
    bucket:      'creative',
    key:         s3Key,
    body:        Buffer.from(bytes),
    contentType: 'application/pdf',
  });

  const downloadUrl = await createPresignedDownloadUrl({
    bucket:    'creative',
    key:       s3Key,
    expiresIn: 3600,
  });

  return { downloadUrl, s3Key, sizeBytes: bytes.byteLength };
}
