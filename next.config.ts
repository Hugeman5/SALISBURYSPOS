
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pre-approve dev origins so future Next versions don’t block you.
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://localhost:9000',
    // Cloud Workstations (broad allow for your sessions)
    'https://*.cloudworkstations.dev',
  ],
};

export default nextConfig;
