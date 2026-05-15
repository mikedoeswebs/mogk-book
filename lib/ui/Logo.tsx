/**
 * MO Goalkeeping wordmark.
 *
 *   MO  /  GOALKEEPING
 *   ──  ─  ───────────
 *   800 800 400 (italic slash, lime)
 *
 * Pass a size className (e.g. "text-lg") to scale the whole mark. Pass an
 * accentClassName override if you ever need to render it on a non-dark surface.
 */
export function Logo({
  size = 'text-base',
  className = '',
}: {
  size?: string;
  className?: string;
}) {
  return (
    <span
      className={`font-heading uppercase inline-flex items-baseline leading-none ${size} ${className}`}
      aria-label="MO Goalkeeping"
    >
      <span className="font-extrabold tracking-tight text-fg">MO</span>
      <span className="font-extrabold italic text-accent mx-[0.15em]" aria-hidden>/</span>
      <span className="font-normal tracking-[0.08em] text-fg">GOALKEEPING</span>
    </span>
  );
}
