import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Le SDK Gandalf est publié en sources TS — Next doit le transpiler.
  transpilePackages: ["@bleuh-co/gandalf-sdk-next"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
