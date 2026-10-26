import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureBERT 2.0 AI Investigation Agent",
  description:
    "Four SecureBERT 2.0-grounded correlation and retrieval demos spanning classic intrusions and AI-native attacks, mapped to MITRE ATT&CK and ATLAS.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full flex flex-col overflow-hidden">{children}</body>
    </html>
  );
}
