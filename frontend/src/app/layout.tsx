import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { PrivacyProvider } from "@/components/privacy-provider";
import { StorageProvider } from "@/components/storage-provider";
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
  title: "BudgetOnTarget",
  description: "Personal household spending dashboard",
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
        <StorageProvider>
          <PrivacyProvider>
            <Suspense>
              <Sidebar />
            </Suspense>
            <main className="ml-60 min-h-screen p-6">{children}</main>
          </PrivacyProvider>
        </StorageProvider>
      </body>
    </html>
  );
}
