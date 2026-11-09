import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdfkit reads its font files from disk, so it must not be bundled.
  serverExternalPackages: ['pdfkit'],
  // The old text page is now the "How it works" section on the home page.
  async redirects() {
    return [{ source: '/how-it-works', destination: '/#how', permanent: true }];
  },
};

export default nextConfig;
