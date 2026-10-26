
import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google"; // Adding Outfit for that premium look mentioned in Flutter app
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: '--font-outfit' });
const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });

export const metadata: Metadata = {
  title: "Koji Admin",
  description: "Administration Dashboard for Koji",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased bg-gray-50 text-gray-900`}>
        {children}
      </body>
    </html>
  );
}
