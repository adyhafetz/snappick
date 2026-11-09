import type { Metadata } from 'next';
import { Dashboard } from '@/components/Dashboard';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { fetchSnapshot } from '@/lib/data';
import { llmConfigured } from '@/lib/llm';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let snapshot;
  let error: string | null = null;
  try {
    snapshot = await fetchSnapshot();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load the statistics.';
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-10">
        <h1 className="mb-6 text-4xl font-bold">Recycling in Perak</h1>
        {snapshot ? (
          <Dashboard snapshot={snapshot} aiEnabled={llmConfigured()} />
        ) : (
          <p className="rounded-3xl bg-card p-6 ring-1 ring-border">{error}</p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
