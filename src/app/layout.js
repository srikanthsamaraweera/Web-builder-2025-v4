import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBarWrapper from "@/components/TopBarWrapper";
import DebugOverlay from "@/components/DebugOverlay";
import PageContainer from "@/components/PageContainer";
import { Suspense } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseHost = null;
try {
  supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : null;
} catch {}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Web Directory",
  description: "Create your own website",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {supabaseHost && (
          <>
            <link rel="dns-prefetch" href={`//${supabaseHost}`} />
            <link rel="preconnect" href={`https://${supabaseHost}`} crossOrigin="" />
          </>
        )}
        <link rel="preconnect" href="https://challenges.cloudflare.com" crossOrigin="" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-white text-gray-900`}
      >
        <TopBarWrapper />
        <Suspense fallback={null}>
          <DebugOverlay />
        </Suspense>
        <PageContainer>{children}</PageContainer>
      </body>
    </html>
  );
}
