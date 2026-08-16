import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BudgetOnTarget — Budget targets that live in your browser",
  description:
    "Import your bank CSVs, set spending targets with tolerance bands, and track them month over month. No account, no server — your data stays in a file you own.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BudgetOnTarget",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#10B981",
};

/**
 * Root layout for every route, marketing and app alike.
 *
 * Deliberately thin: the store, privacy context, and app chrome live in
 * `app/app/layout.tsx` so the landing page renders as static HTML with no
 * IndexedDB read and no wizard gating.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
