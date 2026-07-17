import { LINE_BADGE_BG, LINE_LETTER } from '../features/journey/constants';

interface LineBadgeProps {
  line: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function LineBadge({ line, size = 'sm' }: LineBadgeProps) {
  const sz =
    size === 'xl' ? 'w-14 h-14 text-2xl' :
    size === 'lg' ? 'w-10 h-10 text-base' :
    size === 'md' ? 'w-7 h-7 text-xs' :
    size === 'xs' ? 'w-5 h-5 text-[9px]' :
    'w-6 h-6 text-[11px]';

  return (
    <span
      className={`${sz} rounded-full flex items-center justify-center font-black shrink-0`}
      style={{ background: LINE_BADGE_BG[line], color: line === 'yellow' ? '#000' : '#fff' }}
    >
      {LINE_LETTER[line]}
    </span>
  );
}
