import type { Metadata } from "next";
import { Geist, Geist_Mono, Fira_Code } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
});

const formaDJR = localFont({
  src: "../fonts/FormaDJRDisplay-Medium.ttf",
  variable: "--font-forma",
  display: "swap",
});

const formaDJRItalic = localFont({
  src: "../fonts/FormaDJRDisplay-MediumItalic.ttf",
  variable: "--font-forma-italic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Khabri",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${firaCode.variable} ${formaDJR.variable} ${formaDJRItalic.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
