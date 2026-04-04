import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_SC, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-sc",
});

export const metadata: Metadata = {
  title: {
    default: "SoldLog",
    template: "%s · SoldLog",
  },
  description: "Showcase closed deals with a premium, mobile-first profile.",
  applicationName: "SoldLog",
  icons: {
    apple: "/icons/192",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SoldLog",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${notoSansSC.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
