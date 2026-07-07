import type { CreativeContentFormat } from '@/features/creative-studio/types';

/** Instagram-style story dot gradient (spec). */
export const STORY_DOT_GRADIENT =
  'linear-gradient(to top right, #f9ce34, #ee2a7b, #6228d7)';

export type SocialDotVisual =
  | { kind: 'class'; className: string }
  | { kind: 'gradient'; gradient: typeof STORY_DOT_GRADIENT };

/**
 * Dot marker for calendar cells / sidebar — Story uses gradient, others Tailwind utilities.
 */
export function socialDotVisual(format: CreativeContentFormat | null | undefined): SocialDotVisual {
  switch (format) {
    case 'story':
      return { kind: 'gradient', gradient: STORY_DOT_GRADIENT };
    case 'carousel':
      return { kind: 'class', className: 'bg-amber-400' };
    case 'reel':
      return { kind: 'class', className: 'bg-violet-400' };
    case 'feed_post':
    default:
      return { kind: 'class', className: 'bg-cyan-400' };
  }
}

/** Day list / detail icon chip — Story uses layered gradient cue. */
export function socialIconRowClass(format: CreativeContentFormat | null | undefined): string {
  switch (format) {
    case 'story':
      return 'text-white bg-gradient-to-br from-amber-300/25 via-pink-500/20 to-violet-600/25 border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
    case 'carousel':
      return 'text-amber-300 bg-amber-500/10 border border-amber-500/20';
    case 'reel':
      return 'text-violet-300 bg-violet-500/10 border border-violet-500/20';
    case 'feed_post':
    default:
      return 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20';
  }
}
