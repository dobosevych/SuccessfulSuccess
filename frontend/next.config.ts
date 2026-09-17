import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" is what the `production` stage in the Dockerfile needs.
  // `make aws-deploy-frontend` sets NEXT_OUTPUT=export instead, to get the
  // static files that go to S3 and CloudFront.
  output: process.env.NEXT_OUTPUT === "export" ? "export" : "standalone",
};

export default nextConfig;
