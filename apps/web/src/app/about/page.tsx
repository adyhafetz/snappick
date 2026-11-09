import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, HandHeart, Recycle, ShieldCheck } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export const metadata: Metadata = { title: 'About' };

const PILLARS = [
  { icon: Recycle, title: 'Easy for residents', text: 'Snap a photo, check what is recyclable, and request a pickup in a few taps. Detection runs on your phone, so it works even with a weak signal.' },
  { icon: HandHeart, title: 'Made for collectors', text: 'Collectors see open requests nearby on a live map, claim the jobs they want, and finish with a proof photo. Ratings keep everyone accountable.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'Your exact address is shared only with the collector who accepts your request. Photos are stripped of location data before upload.' },
  { icon: BarChart3, title: 'Open about the results', text: 'The public dashboard shows totals by district, with small groups hidden, so communities and decision makers can see what is working.' },
];

export default function About() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="bg-secondary/60">
          <div className="mx-auto max-w-3xl px-5 pb-16 pt-14">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">About</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Making household recycling effortless in Perak.</h1>
            <p className="mt-5 text-lg text-ink/75">
              SnapPick connects people who want to recycle with neighbours who love to collect. You snap a photo, SnapBot helps you check the material, and a nearby collector comes to pick it up.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="text-3xl font-bold">Why we built it</h2>
          <p className="mt-4 text-ink/75">
            Recycling in Perak is voluntary. Many households would likely recycle if it were easier. Sorting, cleaning and carrying bags to a drop-off point takes time that busy people do not have, while others are happy to collect what is set aside.
          </p>
          <p className="mt-4 text-ink/75">
            SnapPick bridges the two. It also shows, with real numbers, how many people take part, where, and what they recycle, so communities and decision makers can see what works and where help is needed.
          </p>
        </section>

        <section className="mx-auto max-w-5xl px-5 pb-16">
          <div className="grid gap-5 sm:grid-cols-2">
            {PILLARS.map((p) => (
              <div key={p.title} className="rounded-3xl bg-card p-7 ring-1 ring-border">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <p.icon size={22} />
                </span>
                <h3 className="mt-4 text-xl font-bold">{p.title}</h3>
                <p className="mt-2 text-ink/75">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-16">
          <h2 className="text-3xl font-bold">A community pilot</h2>
          <p className="mt-4 text-ink/75">
            SnapPick is a community pilot for Perak. It is not an official municipal or statutory collection scheme, and the figures on the dashboard come from people using the app, not from every household in Perak.
          </p>
          <p className="mt-4 text-ink/75">
            Detection and advice can be wrong, so the app always asks you to check what it found. We would rather be honest about the limits than promise more than a pilot can deliver.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark">
              See the dashboard <ArrowRight size={18} />
            </Link>
            <Link href="/download" className="rounded-full border border-ink/20 px-6 py-3 font-medium hover:bg-secondary">Download the app</Link>
            <Link href="/privacy" className="rounded-full border border-ink/20 px-6 py-3 font-medium hover:bg-secondary">Privacy and policy</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
