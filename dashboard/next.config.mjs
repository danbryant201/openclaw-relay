/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  basePath: '/dashboard',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
