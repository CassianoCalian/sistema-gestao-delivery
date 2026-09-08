import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { CartProvider } from "../context/CartContext";

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
  title: {
    default: "Depósito do Zé",
    template: "%s | Depósito do Zé",
  },
  description:
    "Cervejas, bebidas, combos, energéticos, refrigerantes e gelo com entrega rápida no Depósito do Zé.",
  applicationName: "Depósito do Zé",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
