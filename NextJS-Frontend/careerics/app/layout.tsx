import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppReadyProvider } from "@/components/AppReadyProvider";
import { Providers } from "@/providers";
import "../styles/globals.scss";
import "../styles/variables.css";

const jura = localFont({
  src: "../public/fonts/Jura-latin.woff2",
  variable: "--font-jura",
  display: "swap",
});

const novaSquare = localFont({
  src: "../public/fonts/NovaSquare-latin.woff2",
  variable: "--font-nova-square",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CareeriCS",
    template: "%s | CareeriCS",
  },
  description: "CareeriCS - your career in computer science starts here.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${jura.variable} ${novaSquare.variable} antialiased`}
        style={{ backgroundColor: "var(--bg-color)" }}
      >
        <AppReadyProvider>
          <Providers>{children}</Providers>
        </AppReadyProvider>
      </body>
    </html>
  );
}
