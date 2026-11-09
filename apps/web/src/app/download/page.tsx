import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export const metadata: Metadata = { title: 'Download' };

export default function DownloadPage() {
  const url = process.env.NEXT_PUBLIC_APK_URL;
  const version = process.env.NEXT_PUBLIC_APK_VERSION;
  const size = process.env.NEXT_PUBLIC_APK_SIZE;
  const sha = process.env.NEXT_PUBLIC_APK_SHA256;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-14">
        <h1 className="text-4xl font-bold">Download SnapPick</h1>
        <p className="mt-3 text-ink/80">SnapPick is an Android app. It is installed directly from this page.</p>

        <div className="mt-8 rounded-3xl bg-card p-6 ring-1 ring-border">
          {url ? (
            <>
              <a href={url} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark">
                <Download size={18} /> Download APK
              </a>
              <dl className="mt-5 grid gap-2 text-sm">
                {version && <div><dt className="inline text-muted-foreground">Version </dt><dd className="inline">{version}</dd></div>}
                {size && <div><dt className="inline text-muted-foreground">Size </dt><dd className="inline">{size}</dd></div>}
                {sha && <div><dt className="text-muted-foreground">SHA-256</dt><dd className="break-all font-mono text-xs">{sha}</dd></div>}
              </dl>
            </>
          ) : (
            <p className="text-ink/80">The first release is not published yet. Please check back soon.</p>
          )}
        </div>

        <h2 className="mt-10 text-2xl font-bold">Install</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-ink/80">
          <li>Download the file on your Android phone.</li>
          <li>Open it. If asked, allow installs from your browser or files app.</li>
          <li>Open SnapPick and sign in.</li>
        </ol>
      </main>
      <SiteFooter />
    </>
  );
}
