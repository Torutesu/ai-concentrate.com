import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Concentrate — ShogunAI Marketing Studio",
  description:
    "企画の原液を磨き、X・記事・Reddit・動画へ展開する編集ワークスペース。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === "development" && (
          <script
            src="https://mcp.figma.com/mcp/html-to-design/capture.js"
            async
          />
        )}
      </body>
    </html>
  );
}
