/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow Firebase Studio proxy origin in dev (Cloud Workstations).
    allowedDevOrigins: ['https://*.cloudworkstations.dev'],
  },
  reactStrictMode: true,
};
export default nextConfig;
