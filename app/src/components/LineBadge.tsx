import { LINE_COLOR, LINE_LETTER } from '../features/journey/constants';

interface LineBadgeProps {
  line: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function LineBadge({ line, size = 'sm' }: LineBadgeProps) {
  const sz =
    size === 'xl' ? 'w-14 h-14 text-title-2' :
    size === 'lg' ? 'w-10 h-10 text-callout' :
    size === 'md' ? 'w-7 h-7 text-caption' :
    size === 'xs' ? 'w-5 h-5 text-caption' :
    'w-6 h-6 text-caption';

  return (
    <span
      // `font-bold` (700), not `font-black` (900): `index.html` requests Space
      // Grotesk at 400;500;600;700, so 900 was synthesised by the browser —
      // smeared outlines on the single most repeated glyph in the product.
      // Fixed here rather than by widening the request, which would put another
      // weight on the render-blocking font path (§5.6).
      className={`${sz} rounded-full flex items-center justify-center font-bold shrink-0`}
      // Black on all four fills, not white-except-yellow. Measured against the
      // signage hex: white reaches only 3.68 / 3.76 / 3.96 on blue, red and
      // violet — three failures the conditional was creating rather than
      // avoiding — while black clears 5.31–10.95 on every one. Deleting the
      // special case and fixing the contrast turn out to be the same edit.
      style={{ background: LINE_COLOR[line], color: 'var(--c-on-line)' }}
    >
      {LINE_LETTER[line]}
    </span>
  );
}
