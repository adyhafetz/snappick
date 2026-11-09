import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export const metadata: Metadata = { title: 'Privacy and policy' };

// Every statement here matches what the app and database do (see apps/mobile: upload.ts, proof-metadata.ts,
// delete-stored-files.ts, profile.tsx, the consent screens, and docs/ARCHITECTURE.md). Update it when those change.
interface Section {
  title: string;
  points: string[];
}

const PRIVACY: Section[] = [
  {
    title: 'Your photos',
    points: [
      'Scanning runs on your phone. Photos are only uploaded if you have turned on Cloud Photo Sync in Profile, and you can turn it off at any time.',
      'Before upload, a photo is shrunk to at most 800 pixels, saved as a compressed JPEG, and stripped of its location and other hidden metadata. Proof photos are cleaned the same way.',
      'AI Model Training is a separate, opt-in switch. Only scans from people who opt in can help train a better detector, and a person reviews the label edits before any new model goes live.',
    ],
  },
  {
    title: 'Your location',
    points: [
      'Your exact address and meeting spot are shared only with the collector who accepts your request.',
      'Everyone else sees an approximate spot snapped to a grid roughly a kilometre wide, and the district.',
    ],
  },
  {
    title: 'The public dashboard',
    points: [
      'It shows totals only, by district and by month.',
      'Any figure based on fewer than 5 households is hidden.',
      'It never shows names, photos or addresses.',
    ],
  },
  {
    title: 'Deleting your account',
    points: [
      'In Profile, tap Delete Account and confirm.',
      'The app first removes the scan photos and proof photos you uploaded. If any photo cannot be removed, the deletion stops and you can try again.',
      'Then your account is deleted, with your personal info, addresses and saved scans. Your open requests are cancelled, and pickups you were collecting go back to the map for someone else.',
      'One limit: anonymised images that were already used in past AI training sets cannot be removed one by one.',
    ],
  },
];

const POLICY: Section[] = [
  {
    title: 'What can be offered for pickup',
    points: [
      'Recyclable plastic, paper, cardboard, metal and glass that is clean and dry.',
      'No hazardous materials. Batteries, chemicals and sharps are excluded, and batteries, bulbs, chemicals and electronics are declared by you, never guessed by the app.',
      'The detector can be wrong. Detections under 80% are marked "Low confidence" and need your tap to confirm, so check every item before you send a request.',
    ],
  },
  {
    title: 'When you request a pickup',
    points: [
      'Give accurate item counts, clear access instructions and a safe, accessible meeting spot, with daytime hours.',
      'You can have up to 5 open requests at a time.',
      'Requests are for addresses inside the 13 districts of Perak.',
    ],
  },
  {
    title: 'When you collect',
    points: [
      'You can hold up to 3 active jobs at a time. A job you claim but do not start returns to the map after 24 hours.',
      'Finish with a proof photo taken within the last 12 hours, or report why nothing was collected: contaminated, missing, unsafe, access issue or other.',
      'Hand over promptly and respect the people you meet.',
    ],
  },
  {
    title: 'Confirmations, ratings and disputes',
    points: [
      'The requester confirms a pickup by rating the collector from 1 to 5 stars. Only collectors are rated.',
      'If nobody responds, a pickup completes by itself 48 hours after the proof is submitted, unless it is disputed.',
      'Anyone can report an issue. An administrator reviews each dispute. If it is upheld, the pickup is marked not collected, it counts as a 1-star rating for the collector, and the requester can list it again.',
    ],
  },
  {
    title: 'SnapBot and general guidance',
    points: [
      'SnapBot gives general recycling advice. It is not official guidance, and it can be wrong, so follow local rules when in doubt.',
    ],
  },
  {
    title: 'A community pilot',
    points: [
      'SnapPick is a community pilot for Perak. It is not an official municipal or statutory collection scheme.',
      'We may update this page as the app changes. The version here describes how the app works today.',
    ],
  },
];

function Block({ heading, id, sections }: { heading: string; id: string; sections: Section[] }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-3xl font-bold">{heading}</h2>
      <div className="mt-6 space-y-5">
        {sections.map((s) => (
          <div key={s.title} className="rounded-3xl bg-card p-7 ring-1 ring-border">
            <h3 className="text-xl font-bold">{s.title}</h3>
            <ul className="mt-4 space-y-3 text-ink/80">
              {s.points.map((p) => (
                <li key={p} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-14">
        <h1 className="text-4xl font-bold">Privacy and policy</h1>
        <p className="mt-3 text-ink/75">How SnapPick treats your data, and the rules everyone follows when they request or collect.</p>
        <nav aria-label="On this page" className="mt-6 flex gap-3 text-sm">
          <a href="#privacy" className="rounded-full bg-secondary px-4 py-2 font-medium text-primary hover:bg-[#dce8df]">Privacy</a>
          <a href="#policy" className="rounded-full bg-secondary px-4 py-2 font-medium text-primary hover:bg-[#dce8df]">Community policy</a>
        </nav>
        <div className="mt-12 space-y-16">
          <Block heading="Privacy" id="privacy" sections={PRIVACY} />
          <Block heading="Community policy" id="policy" sections={POLICY} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
