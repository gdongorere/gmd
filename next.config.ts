/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Recommended for Next.js 15
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        port: '',
        pathname: '/images/**',
      },
      // Add other remote image patterns here if you have other external image sources
    ],
  },
  // Other Next.js configurations can go here
  // For example, if you were using Tailwind CSS, you might have:
  // experimental: {
  //   taint: true, // For data fetching security
  // },
  // compiler: {
  //   removeConsole: process.env.NODE_ENV === 'production',
  // },
  // Standalone /fly deployment (docs/plan-fly-standalone-deploy.md): a second Vercel project built from this
  // same repo, with NEXT_PUBLIC_FLY_STANDALONE=1 set, so its root shows the flight sim instead of the portfolio
  // homepage. Unset (the normal portfolio deployment) this is a no-op.
  async redirects() {
    if (process.env.NEXT_PUBLIC_FLY_STANDALONE !== '1') return [];
    return [{ source: '/', destination: '/fly', permanent: false }];
  },
};

module.exports = nextConfig;
