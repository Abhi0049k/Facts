import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Facts",
  description: "AI-powered competitor intelligence, grounded in real data"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
