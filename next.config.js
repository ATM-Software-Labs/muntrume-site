/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'members-ng.iracing.com' },
      { protocol: 'https', hostname: '**.iracing.com' }
    ]
  }
};
