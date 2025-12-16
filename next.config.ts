import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb', // Images via Server Actions
    },
    proxyClientMaxBodySize: '25mb', // Chunked uploads - max 5MB chunks + metadata
  },
};

export default nextConfig;
