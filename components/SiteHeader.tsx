import Link from "next/link";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
      <Link className="text-[15px] font-semibold tracking-tight text-ink" href="/">
        Facts
      </Link>
      <nav className="flex items-center gap-6 text-sm text-muted">
        {compact ? (
          <Link className="transition hover:text-ink" href="/">
            New briefing
          </Link>
        ) : (
          <a className="transition hover:text-ink" href="#method">
            Method
          </a>
        )}
        <Link className="transition hover:text-ink" href="/results">
          Last report
        </Link>
      </nav>
    </header>
  );
}
