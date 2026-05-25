import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { PrivacyProvider } from "@/components/privacy-provider";
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
        <PrivacyProvider>
          <Suspense>
            <Sidebar />
          </Suspense>
          <main className="ml-60 min-h-screen p-6">{children}</main>
        </PrivacyProvider>
      </body>
    </html>
  );
}
