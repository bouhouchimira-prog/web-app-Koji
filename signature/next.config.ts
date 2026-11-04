import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixe la racine du workspace a ce dossier (26 oct) : meme correctif que
  // admin/next.config.ts, necessaire depuis le passage en monorepo avec
  // koji-web (sinon 404 generalise une fois deploye sur Vercel malgre un
  // build reussi). Voir admin/next.config.ts pour le detail.
  turbopack: {
    // Racine du monorepo (parent de signature/) pour resoudre les packages
    // hoistés (node_modules partagé à la racine).
    root: require("path").resolve(__dirname, ".."),
  },
  // Permet a Next.js de compiler le package partage @koji/shared (ESM).
  transpilePackages: ['@koji/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
