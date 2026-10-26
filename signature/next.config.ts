import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixe la racine du workspace a ce dossier (26 oct) : meme correctif que
  // admin/next.config.ts, necessaire depuis le passage en monorepo avec
  // koji-web (sinon 404 generalise une fois deploye sur Vercel malgre un
  // build reussi). Voir admin/next.config.ts pour le detail.
  turbopack: {
    root: __dirname,
  },
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
