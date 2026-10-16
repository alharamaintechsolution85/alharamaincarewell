import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carewell | Accessible care",
  description:
    "An accessibility-first care coordination workspace for patients and care teams.",
  applicationName: "Carewell",
  openGraph: {
    title: "Carewell | Accessible care",
    description:
      "An accessibility-first care coordination workspace for patients and care teams.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
