import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Images via Server Actions
    },
    proxyClientMaxBodySize: '10mb', // Chunked uploads - max 5MB chunks + metadata
  },
};

export default nextConfig;
