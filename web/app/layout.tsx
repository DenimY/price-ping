import type { ReactNode } from "react";
import "./globals.css";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata = {
  title: "Price Ping",
  description: "가격 변동 알림 서비스"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6">
          <header className="mb-6 flex items-center justify-between border-b border-slate-800 pb-3">
            <h1 className="text-lg font-semibold tracking-tight">Price Ping</h1>
            <LogoutButton />
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

