import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { version } = require('next/package.json');

const isV15Plus = Number(version.split('.')[0]) >= 15;

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    ...(isV15Plus
      ? {
          // When you upgrade to Next 15+, add your dev origins here.
          // Example (replace with the exact value shown in the console warning):
          // allowedDevOrigins: [
          //   'https://3110-firebase-studio-XXXXXXXX.cloudworkstations.dev',
          //   'http://localhost:3110',
          // ],
        }
      : {}),
  },
};

export default nextConfig;
