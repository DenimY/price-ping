import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">
        관심 상품 가격을 편하게 추적하세요
      </h2>
      <p className="max-w-md text-sm text-slate-300">
        네이버 스토어 상품을 등록해두면, 설정한 목표 가격에 도달했을 때 알림을 받을 수
        있습니다.
      </p>
      <div className="mt-4 flex gap-3">
        <Link
          href="/auth/register"
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          이메일로 시작하기
        </Link>
        <Link
          href="/auth/login"
          className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900"
        >
          로그인
        </Link>
      </div>
    </div>
  );
}

