import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import AppShell from "@/components/AppShell";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NCFE Curriculum Hub – Drive Test",
  description: "Google Drive integration test",
};

// Fit phone screens; stops iPhone auto-zooming into small text boxes.
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: hides warnings caused by browser extensions (e.g. ColorZilla) */}
      <body className="h-full font-sans" suppressHydrationWarning>
        <AppShell sidebar={<Sidebar />}>{children}</AppShell>
      </body>
    </html>
  );
}
