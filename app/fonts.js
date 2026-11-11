import { DM_Sans as DMSansFont, Shippori_Mincho as ShipporiFont } from 'next/font/google';

export const DM_Sans = DMSansFont({
  subsets: ['latin'],
  variable: '--lp-font',
});

// Titres de l'univers Particulier (charte v2) : SITE-02, /particulier.
export const Shippori = ShipporiFont({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--lc-serif',
});
