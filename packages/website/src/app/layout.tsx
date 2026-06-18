import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const SITE_URL = "https://huxpro.github.io/react-doctor";
// Static-export metadata URLs aren't auto-prepended with basePath, so
// build them by hand. Twitter/OG URLs go through `metadataBase` so they
// stay absolute; the icon URL has to be path-only.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const TWITTER_IMAGE_PATH = `${BASE_PATH}/react-doctor-og-banner.svg`;
const ICON_PATH = `${BASE_PATH}/react-doctor-icon.svg`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "React Doctor — ReactLynx extension",
  description: "An extension of react.doctor that adds ReactLynx-specific checks. Upstream catches bad React; this catches dual-thread footguns Lynx crashes on.",
  twitter: {
    card: "summary_large_image",
    images: [TWITTER_IMAGE_PATH],
  },
  icons: { icon: ICON_PATH },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${ibmPlexMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
