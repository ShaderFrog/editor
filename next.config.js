const path = require('path');

/** @type {import('next').NextConfig} */
module.exports = {
  // Disable double rendering which causes issues with editor mounting / unmounting
  reactStrictMode: false,

  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Allow SVG imports
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve.alias,

        babylonjs: path.resolve(
          __dirname,
          'node_modules/babylonjs/babylon.max.js'
        ),
        'babylonjs-loaders': path.resolve(
          __dirname,
          'node_modules/babylonjs-loaders/babylonjs.loaders.js'
        ),
      },
    };

    // Hard code the "@shaderfrog/core" npm link'd path so that we can load its
    // typescript files directly (aka @shaderfrog/core/src/...)
    // config.module.rules = config.module.rules.map((rule) =>
    //   /\bts\b/.test(rule.test?.toString())
    //     ? {
    //         ...rule,
    //         include: [
    //           ...rule.include,
    //           path.resolve(__dirname, '../core-shaderfrog'),
    //         ],
    //       }
    //     : rule
    // );

    // Important: return the modified config
    return config;
  },
};
