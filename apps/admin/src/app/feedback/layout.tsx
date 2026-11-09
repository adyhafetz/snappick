import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dataset' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
