import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by the `production` stage in the Dockerfile.
  output: "standalone",
};

export default nextConfig;
