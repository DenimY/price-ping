import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { AppUrlListener } from "@/components/AppUrlListener";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentUserProfile, isAdminProfile } from "@/lib/accessControl";

export const metadata: Metadata = {
  title: "Price Ping",
  description: "가격 변동 알림 서비스"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617"
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await getCurrentUserProfile();
  const isAdmin = isAdminProfile(profile);

  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <AppUrlListener />
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6 app-safe-area">
          <header className="mb-6 flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-4">
              <Link href={user ? "/dashboard" : "/"} className="text-lg font-semibold tracking-tight">
                Price Ping
              </Link>
              {user && (
                <nav className="flex items-center gap-3 text-sm text-slate-300">
                  <Link href="/dashboard" className="hover:text-white">
                    대시보드
                  </Link>
                  {isAdmin && (
                    <>
                      <Link href="/admin/users" className="hover:text-white">
                        유저관리
                      </Link>
                      <Link href="/admin/scraper-test" className="hover:text-white">
                        크롤링 테스트
                      </Link>
                    </>
                  )}
                </nav>
              )}
            </div>
            {user ? <LogoutButton /> : null}
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

