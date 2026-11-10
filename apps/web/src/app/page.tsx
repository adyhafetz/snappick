import Link from 'next/link';
import { ArrowRight, BookOpen, Bot, ChevronDown, ExternalLink, HandHeart, History, Lock, MapPin, ScanLine, ShieldCheck } from 'lucide-react';
import { Phone } from '@/components/Phone';
import { PhoneVideo } from '@/components/PhoneVideo';
import { Logo, SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { FAQ, PERAK_ECO_NEWS } from '@/content/site';
import { fetchSnapshot } from '@/lib/data';
import { districtSummaries, keyNumbers } from '@/lib/selectors';

export const dynamic = 'force-dynamic';

const STEPS = [
  { n: '01', id: 'scan', icon: ScanLine, role: 'Resident', title: 'Point, snap, check', video: 'scan', alt: 'Screen recording: scanning a plastic bottle and seeing the detected materials',
    text: 'Take a photo or pick one from your gallery. The detector runs on your phone, so it works without internet. It marks each item, lists the materials it found, and lets you fix anything it got wrong.',
    points: ['Camera or gallery', 'Works offline', 'Edit what it found'] },
  { n: '02', id: 'guidance', icon: BookOpen, role: 'Resident', title: 'Know how to prepare each item', video: 'guidance', alt: 'Screen recording: the animated preparation guide for plastic',
    text: 'Every material comes with a short animated guide, plus a quick safety check. Then choose: schedule a pickup, or recycle it yourself.',
    points: ['Step-by-step preparation', 'Safety checklist', 'Schedule or recycle yourself'] },
  { n: '03', id: 'request', icon: HandHeart, role: 'Resident', title: 'Schedule a pickup in a few taps', video: 'request', alt: 'Screen recording: choosing a day and time window and submitting a pickup request',
    text: 'Confirm your address, choose a day and a morning or afternoon window, and send. Your exact address stays private until a collector accepts.',
    points: ['Pin inside Perak', 'Morning or afternoon', 'Address kept private'] },
  { n: '04', id: 'collect', icon: MapPin, role: 'Collector', title: 'A live map of pickups near you', video: 'collect', alt: 'Screen recording: tapping a pin on the Collect map and claiming a task',
    text: 'Open requests appear as pins that update in real time. Tap one to see what is on offer, and claim up to three jobs at a time.',
    points: ['Real-time pins', 'Up to 3 active jobs', 'Route and navigation'] },
  { n: '05', id: 'follow', icon: History, role: 'Both', title: 'See every request and every task', video: 'activity', alt: 'Screen recording: switching between My Requests and Claimed Tasks and filtering by status',
    text: 'My Requests shows what you have asked for, and Claimed Tasks what you are collecting. Filter by active or completed.',
    points: ['My Requests and Claimed Tasks', 'Active and completed', 'Clear status'] },
  { n: '06', id: 'confirm', icon: ShieldCheck, role: 'Both', title: 'Confirm, rate, or report a problem', video: 'confirm', alt: 'Screen recording: confirming a collection and rating the collector',
    text: 'The collector finishes with a proof photo. You confirm and rate from 1 to 5 stars, or report an issue. After 48 hours it completes on its own.',
    points: ['Proof photo', '1 to 5 stars', 'Report an issue'] },
];

const PERSONAS = [
  {
    who: 'For the ones who mean to recycle',
    quote: 'I want to recycle. I just don’t have the time.',
    text: 'You want to recycle, but life gets busy and bags pile up by the door. SnapPick does the heavy lifting. Snap a quick photo to check the material, pick a time, and let a neighbor come collect it.',
    points: ['No lugging bags to a drop-off point', 'No guessing what is recyclable', 'Your address stays private until someone accepts'],
  },
  {
    who: 'For the ones who love to collect',
    quote: 'I see value where others just see trash.',
    text: 'You already notice what others throw away. SnapPick shows you who nearby has set it aside, ready to collect. See the pins, claim up to three jobs, follow the route, and finish with a proof photo.',
    points: ['A live map of pickups near you', 'Navigate with Google Maps or Waze', 'Ratings build your reputation'],
  },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl bg-white/10 p-6 ring-1 ring-white/15">
      <p className="text-4xl font-bold tabular-nums text-white sm:text-5xl">{value}</p>
      <p className="mt-2 text-sm text-white/70">{label}</p>
    </div>
  );
}

export default async function Home() {
  let nums: { completed: number; households: number; districts: number } | null = null;
  let top: { name: string; completed: number }[] = [];
  try {
    const snap = await fetchSnapshot();
    const k = keyNumbers(snap, 'all', 'state');
    if (!k.suppressed) {
      const rows = districtSummaries(snap, 'all').filter((d) => !d.suppressed);
      nums = { completed: k.completed, households: k.households, districts: rows.length };
      top = rows.slice(0, 4).map((d) => ({ name: d.name, completed: d.completed }));
    }
  } catch {
    nums = null;
  }
  const fmt = (n: number) => n.toLocaleString('en-GB');

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-secondary" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 md:grid-cols-[1.1fr_0.9fr] md:pt-20">
            <div>
              <h1 className="text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">
                You <span className="text-primary">Snap</span> It,
                <br />
                Your Neighbors
                <br />
                <span className="text-primary">Pick</span> It
              </h1>
              <p className="mt-6 max-w-lg text-lg text-ink/75">
                Scan waste in seconds, check what&apos;s recyclable, and coordinate effortless pickups with community near you.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-medium text-white shadow-sm hover:bg-primary-dark">
                  Live dashboard <ArrowRight size={18} />
                </Link>
                <Link href="/download" className="rounded-full border border-ink/20 px-7 py-3.5 font-medium text-ink hover:bg-secondary">
                  Download the app
                </Link>
              </div>
            </div>
            <div className="relative flex justify-center pb-4">
              <Phone src="/screens/home.webp" alt="The SnapPick home screen" className="rotate-[3deg]" width={290} />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-secondary/60 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">How it works</p>
            <h2 className="mt-3 max-w-2xl text-4xl font-bold">From sorting stress to effortless doorstep collection.</h2>

            <div className="mt-14 space-y-24">
              {STEPS.map((s, i) => (
                <div id={s.id} key={s.n} className={`grid scroll-mt-24 items-center gap-10 md:grid-cols-2 ${i % 2 ? 'md:[&>*:first-child]:order-2' : ''}`}>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-6xl font-bold leading-none tabular-nums text-primary">{s.n}</span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-primary ring-1 ring-border">
                        <s.icon size={16} /> {s.role}
                      </span>
                    </div>
                    <h3 className="mt-5 text-3xl font-bold">{s.title}</h3>
                    <p className="mt-3 max-w-md text-lg text-ink/75">{s.text}</p>
                    <ul className="mt-5 flex flex-wrap gap-2">
                      {s.points.map((p) => (
                        <li key={p} className="rounded-full bg-white px-3.5 py-1.5 text-sm text-ink/80 ring-1 ring-border">
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex justify-center">
                    <PhoneVideo name={s.video} alt={s.alt} />
                  </div>
                </div>
              ))}
            </div>

            {/* Also in the app */}
            <div className="mt-24">
              <h3 className="text-2xl font-bold">Also in the app</h3>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="flex items-center gap-6 rounded-[2rem] bg-white p-6 ring-1 ring-border">
                  <PhoneVideo name="snapbot" alt="Screen recording: asking SnapBot whether plastic bottle caps should be removed" width={170} className="shrink-0" />
                  <div>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-primary"><Bot size={16} /> SnapBot</span>
                    <h4 className="mt-2 text-xl font-bold">Ask SnapBot</h4>
                    <p className="mt-2 text-sm text-ink/75">Not sure what goes where? Ask from the Home screen, or tap one of the common questions.</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 rounded-[2rem] bg-white p-6 ring-1 ring-border">
                  <PhoneVideo name="privacy" alt="Screen recording: switching the AI Model Training setting on and off in Profile" width={170} className="shrink-0" />
                  <div>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-primary"><Lock size={16} /> Your choices</span>
                    <h4 className="mt-2 text-xl font-bold">You decide what is shared</h4>
                    <p className="mt-2 text-sm text-ink/75">Photo storage and sharing for model training are switches you control. Deleting your account removes your photos too.</p>
                    <Link href="/privacy" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      Privacy and policy <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section id="who" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Who it&apos;s for</p>
          <h2 className="mt-3 max-w-2xl text-4xl font-bold">You leave it out. Others pick it up.</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {PERSONAS.map((p) => (
              <article key={p.who} className="flex flex-col rounded-[2rem] bg-card p-8 ring-1 ring-border">
                <p className="text-sm font-medium uppercase tracking-wider text-primary">{p.who}</p>
                <blockquote className="mt-4 text-2xl font-bold leading-snug">&ldquo;{p.quote}&rdquo;</blockquote>
                <p className="mt-4 text-ink/75">{p.text}</p>
                <ul className="mt-6 space-y-2 text-sm text-ink/85">
                  {p.points.map((x) => (
                    <li key={x} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      {x}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Dashboard teaser */}
        <section className="bg-ink py-20 text-white">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-brandAmber">Community dashboard</p>
                <h2 className="mt-3 max-w-xl text-4xl font-bold">Perak is already recycling. Here is the proof.</h2>
              </div>
              <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-medium text-ink hover:bg-secondary">
                Open the dashboard <ArrowRight size={18} />
              </Link>
            </div>
            {nums && (
              <>
                <div className="mt-12 grid gap-4 sm:grid-cols-3">
                  <Stat value={fmt(nums.completed)} label="Pickups completed" />
                  <Stat value={fmt(nums.households)} label="Households taking part" />
                  <Stat value={String(nums.districts)} label="Districts with reportable activity" />
                </div>
                {top.length > 0 && (
                  <div className="mt-6 rounded-3xl bg-white/10 p-6 ring-1 ring-white/15">
                    <p className="text-sm text-white/70">Most pickups completed</p>
                    <ul className="mt-4 space-y-3">
                      {top.map((d) => (
                        <li key={d.name} className="flex items-center gap-4 text-sm">
                          <span className="w-36 shrink-0">{d.name}</span>
                          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
                            <span className="block h-full rounded-full bg-brandAmber" style={{ width: `${(d.completed / top[0].completed) * 100}%` }} />
                          </span>
                          <span className="w-10 text-right tabular-nums">{d.completed}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* News: the same Perak recycling news as the app's Home tab */}
        <section id="news" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">News</p>
          <h2 className="mt-3 text-4xl font-bold">Latest recycling news in Perak</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PERAK_ECO_NEWS.map((n) => (
              <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-border transition hover:shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={n.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[16/10] w-full object-cover" />
                <div className="flex flex-1 flex-col p-6">
                  <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">{n.category}</span>
                  <h3 className="mt-4 text-lg font-bold leading-snug group-hover:text-primary">{n.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-ink/75">{n.summary}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                    <span className="font-medium text-primary">{n.source}</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      {n.publishedDate} <ExternalLink size={14} />
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-5 pb-20">
          <h2 className="text-center text-4xl font-bold">Questions</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl bg-card px-6 py-4 ring-1 ring-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <ChevronDown className="shrink-0 text-primary transition group-open:rotate-180" size={20} />
                </summary>
                <p className="mt-3 text-ink/75">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Call to action: full logo on a light band */}
        <section className="bg-secondary/60 py-20">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <Logo className="mx-auto h-16 sm:h-20" />
            <h2 className="mt-8 text-4xl font-bold sm:text-5xl">Be part of it</h2>
            <p className="mx-auto mt-3 max-w-md text-ink/75">Download SnapPick. Keep Perak clean, one snap at a time.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/download" className="rounded-full bg-primary px-7 py-3.5 font-medium text-white hover:bg-primary-dark">Download the app</Link>
              <Link href="/dashboard" className="rounded-full border border-ink/20 px-7 py-3.5 font-medium text-ink hover:bg-white">View the dashboard</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
