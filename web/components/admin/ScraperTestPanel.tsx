"use client";

import { FormEvent, useState } from "react";
import { getMallDisplayInfo } from "@/lib/mall";

type ScraperResult = {
  url: string;
  mall: string | null;
  supported: boolean;
  success: boolean;
  missingTitle: boolean;
  missingLastPrice: boolean;
  durationMs: number;
  scraped: {
    title: string | null;
    imageUrl: string | null;
    lastPrice: number | null;
  };
  debugHtml?: Array<{
    label: string;
    url: string;
    ok: boolean;
    status: number | null;
    html: string | null;
    error: string | null;
  }>;
};

export function ScraperTestPanel() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScraperResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/scraper-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: url.trim()
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        result?: ScraperResult;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "스크래퍼 테스트에 실패했습니다.");
      }

      setResult(payload.result ?? null);
    } catch (submitError) {
      setResult(null);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "스크래퍼 테스트 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  const mallInfo = getMallDisplayInfo(result?.mall);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-100">가격 감지 테스트</h3>
          <p className="mt-1 text-sm text-slate-400">
            스케줄러와 동일한 스크래퍼 로직으로 상품명과 현재 가격이 감지되는지 바로 확인합니다.
          </p>
        </div>

        <div className="space-y-3">
          <label htmlFor="scraper-test-url" className="block text-sm text-slate-200">
            테스트 URL
          </label>
          <input
            id="scraper-test-url"
            type="url"
            required
            placeholder="https://smartstore.naver.com/... / https://www.coupang.com/... / https://shop.supreme.com/..."
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "테스트 중..." : "테스트 실행"}
        </button>
      </form>

      {result && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${mallInfo.className}`}
            >
              {mallInfo.shortLabel}
            </span>
            <span className="text-sm text-slate-300">{mallInfo.label}</span>
            <span
              className={`rounded-full border px-2 py-1 text-xs ${
                result.success
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/40 bg-red-500/10 text-red-300"
              }`}
            >
              {result.success ? "감지 성공" : "감지 실패"}
            </span>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <p>지원 사이트 여부: {result.supported ? "지원" : "미지원"}</p>
            <p>소요 시간: {result.durationMs}ms</p>
            <p className="sm:col-span-2 break-all">URL: {result.url}</p>
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p>
              상품명: <span className="text-slate-100">{result.scraped.title ?? "-"}</span>
            </p>
            <p className="mt-2">
              현재 가격:{" "}
              <span className="text-slate-100">
                {result.scraped.lastPrice !== null
                  ? `${result.scraped.lastPrice.toLocaleString()}원`
                  : "-"}
              </span>
            </p>
            <p className="mt-2 break-all">
              이미지 URL: <span className="text-slate-100">{result.scraped.imageUrl ?? "-"}</span>
            </p>
            {(!result.success || result.debugHtml?.length) && (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/90">
                <p>누락 상태: {result.missingTitle ? "title 누락" : "title 확인됨"}</p>
                <p className="mt-1">
                  누락 상태: {result.missingLastPrice ? "lastPrice 누락" : "lastPrice 확인됨"}
                </p>
              </div>
            )}
          </div>

          {result.debugHtml && result.debugHtml.length > 0 && (
            <div className="mt-4 space-y-3">
              {result.debugHtml.map((entry) => (
                <details
                  key={`${entry.label}-${entry.url}`}
                  className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
                >
                  <summary className="cursor-pointer text-sm text-slate-200">
                    HTML 디버그: {entry.label} ({entry.status ?? "error"})
                  </summary>
                  <p className="mt-3 break-all text-xs text-slate-400">{entry.url}</p>
                  {entry.error ? (
                    <p className="mt-2 text-sm text-red-400">{entry.error}</p>
                  ) : (
                    <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-all rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
                      {entry.html ?? ""}
                    </pre>
                  )}
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
