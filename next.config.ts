import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // Every route lives under /[lang]; send the bare root to the default locale.
        // Temporary (307) on purpose — the default locale is a business decision that
        // may change, and a cached 308 would be very hard to walk back.
        source: "/",
        destination: "/da",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
