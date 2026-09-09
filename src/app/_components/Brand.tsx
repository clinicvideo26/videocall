/**
 * Brand mark used in every top bar. A teal rounded tile with a pulse/heartbeat
 * glyph — clinical but not clip-arty. `title`/`subtitle` render beside it.
 */
export default function Brand({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M3 12h3l2 5 4-12 2 7h4" />
        </svg>
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
          {title}
        </p>
        {subtitle ? (
          <p className="text-xs text-slate-500">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
