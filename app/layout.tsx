import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Optical",
  description: "Real-time AI that explains the physical world",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
