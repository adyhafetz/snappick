import Link from 'next/link';

const NAV = [
  { href: '/#how', label: 'How it works' },
  { href: '/#who', label: "Who it's for" },
  { href: '/#news', label: 'News' },
  { href: '/download', label: 'Download' },
  { href: '/about', label: 'About' },
];

export function Logo({ className = 'h-8' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo-full.svg" alt="SnapPick" className={`${className} w-auto`} />;
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" aria-label="SnapPick home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hidden rounded-full px-3.5 py-2 text-ink/80 hover:bg-secondary lg:block">
              {n.label}
            </Link>
          ))}
          <Link href="/dashboard" className="press ml-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white shadow-sm hover:bg-primary-dark">
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-full-reversed.svg" alt="SnapPick" className="h-10 w-auto" />
          <p className="mt-4 max-w-xs text-sm">Scan waste in seconds, check what&apos;s recyclable, and coordinate effortless pickups with community near you.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Explore</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
            <li><Link href="/#how" className="hover:text-white">How it works</Link></li>
            <li><Link href="/#who" className="hover:text-white">Who it&apos;s for</Link></li>
            <li><Link href="/#news" className="hover:text-white">News</Link></li>
            <li><Link href="/download" className="hover:text-white">Download</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium text-white">SnapPick</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/about" className="hover:text-white">About</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy and policy</Link></li>
            <li>Android app</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/60">© 2026 SnapPick</div>
    </footer>
  );
}
