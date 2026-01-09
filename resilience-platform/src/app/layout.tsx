import type { Metadata } from "next";
import localFont from "next/font/local";
import { PT_Serif } from "next/font/google";
import "./globals.css";

const geomanist = localFont({
  src: [
    {
      path: "../../public/fonts/geomanist-regular-webfont.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/geomanist-regular-italic-webfont.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

const ptSerif = PT_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Third Factor Resilience Assessment",
  description: "Measure and develop your resilience across seven key areas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geomanist.variable} ${ptSerif.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
