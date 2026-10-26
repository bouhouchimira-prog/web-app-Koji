import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixe la racine du workspace a ce dossier (26 oct) : depuis le passage
  // en monorepo avec koji-web, Next.js detectait a tort le package-lock.json
  // de koji-web (un niveau au-dessus) comme racine, ce qui cassait toutes
  // les routes une fois deploye sur Vercel (404 generalise malgre un build
  // reussi) - voir https://nextjs.org/docs/app/api-reference/config/turbopack#root-directory
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
