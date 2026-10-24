import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureBERT + AIA Correlation",
  description:
    "A SecureBERT-grounded correlation and retrieval demo spanning classic intrusions and AI-native attacks, mapped to MITRE ATT&CK and ATLAS.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
