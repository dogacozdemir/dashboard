import { rgb } from 'pdf-lib';

/**
 * Single source of truth for generated-document styling.
 *
 * Both PDF pipelines (mono Report and the MonoAI chat document) render with these
 * tokens so every artifact that leaves the product carries the same Madmonos
 * identity as the app: deep plum canvas, gold accent, violet secondary.
 */
export const PDF_THEME = {
  /** Page canvas — matches the app background (#0c070c). */
  bg: rgb(0.047, 0.027, 0.047),
  /** Slightly lifted panel/header surface. */
  surface: rgb(0.11, 0.06, 0.11),
  /** Nested card surface. */
  surfaceAlt: rgb(0.09, 0.05, 0.09),
  /** Primary accent — Madmonos gold (#bea042). */
  gold: rgb(0.745, 0.627, 0.259),
  /** Secondary accent — violet (#9c70b2). */
  violet: rgb(0.612, 0.439, 0.722),
  /** Positive / success (emerald). */
  positive: rgb(0.431, 0.906, 0.718),
  /** Negative / risk (rose). */
  negative: rgb(0.984, 0.443, 0.522),
  /** Primary body text. */
  text: rgb(0.92, 0.92, 0.94),
  /** Secondary text. */
  muted: rgb(0.55, 0.52, 0.58),
  /** Hairline separators. */
  line: rgb(0.18, 0.12, 0.18),
  /** Footer strip. */
  footerBg: rgb(0.06, 0.04, 0.07),
} as const;
