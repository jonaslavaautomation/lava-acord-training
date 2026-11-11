import lavaLogo from '@/assets/lava-logo-light.png';
import acordLogo from '@/assets/acord-logo.png';

const SIZES = {
  sm: { lava: 'h-7', acord: 'h-[22px]', badge: 'px-1.5 py-1 rounded-md', divider: 'h-7', gap: 'gap-3' },
  lg: { lava: 'h-12', acord: 'h-9', badge: 'px-2.5 py-1.5 rounded-lg', divider: 'h-12', gap: 'gap-5' },
} as const;

/** LAVA × ACORD co-brand: LAVA mark, thin divider, ACORD mark on a white badge (keeps ACORD's colors legible on dark UI). */
export function BrandLockup({ size = 'sm', className = '' }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <div className={`flex items-center ${s.gap} select-none ${className}`}>
      <img src={lavaLogo} alt="LAVA" className={`${s.lava} w-auto`} draggable={false} />
      <span aria-hidden className={`w-px ${s.divider} bg-white/15`} />
      <span className={`bg-white shadow-sm ring-1 ring-black/5 ${s.badge} flex items-center`}>
        <img src={acordLogo} alt="ACORD" className={`${s.acord} w-auto`} draggable={false} />
      </span>
    </div>
  );
}
