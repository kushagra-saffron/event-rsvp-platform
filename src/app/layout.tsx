import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MoneyStage",
  description:
    "MoneyStage helps you create, discover, and RSVP to finance events.",
  verification: {
    google: "p0MfWb8SIsg47-jGnXDlPBTR5Xk8RWt1aZrFb1BC7Is",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteNav />
        <div className="flex flex-1 flex-col pt-20">{children}</div>
      </body>
    </html>
  );
}
