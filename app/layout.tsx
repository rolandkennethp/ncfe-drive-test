import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NCFE Curriculum Hub – Drive Test",
  description: "Google Drive integration test",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: hides warnings caused by browser extensions (e.g. ColorZilla) */}
      <body className="flex h-screen overflow-hidden font-sans" suppressHydrationWarning>
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
