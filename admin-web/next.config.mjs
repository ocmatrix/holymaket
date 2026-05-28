const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  output: "standalone",
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        {
          module: /chrome-extension/,
        },
        {
          message: /MetaMask/,
        },
        {
          message: /ethereum/,
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
