"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasPasswordConfirm = passwordConfirm.length > 0;
  const isPasswordMismatch = hasPasswordConfirm && password !== passwordConfirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const trimmedFullName = fullName.trim();
      const trimmedNickname = nickname.trim();
      const trimmedPhoneNumber = phoneNumber.trim();

      if (!trimmedFullName) {
        setError("이름을 입력해주세요.");
        return;
      }
      if (!trimmedNickname) {
        setError("닉네임을 입력해주세요.");
        return;
      }
      if (!trimmedPhoneNumber) {
        setError("전화번호를 입력해주세요.");
        return;
      }
      if (isPasswordMismatch) {
        setError("비밀번호가 일치하지 않습니다.");
        return;
      }
      if (!agreedToPrivacy) {
        setError("개인정보 수집 및 이용에 동의해주세요.");
        return;
      }

      const supabase = createBrowserClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: trimmedFullName,
            nickname: trimmedNickname,
            phone_number: trimmedPhoneNumber,
            privacy_consent: true,
            privacy_consent_at: new Date().toISOString()
          }
        }
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      setMessage("회원가입이 완료되었습니다. 이메일로 전송된 인증 링크를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md">
      <h2 className="mb-4 text-xl font-semibold">회원가입</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm">이름</label>
          <input
            type="text"
            required
            maxLength={30}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">닉네임</label>
          <input
            type="text"
            required
            minLength={2}
            maxLength={20}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">전화번호</label>
          <input
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="010-1234-5678"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">이메일</label>
          <input
            type="email"
            required
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">비밀번호</label>
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">비밀번호 확인</label>
          <input
            type="password"
            required
            minLength={8}
            className={`w-full rounded-md border bg-slate-900 px-3 py-2 text-sm outline-none ${
              isPasswordMismatch
                ? "border-red-500 focus:border-red-400"
                : "border-slate-700 focus:border-emerald-500"
            }`}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
          {isPasswordMismatch && (
            <p className="mt-1 text-xs text-red-400">비밀번호가 일치하지 않습니다.</p>
          )}
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              required
              checked={agreedToPrivacy}
              onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900"
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-100">
                개인정보 수집 및 이용 내용에 동의합니다. (필수)
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-400">
                회원가입, 가격 알림, 카카오톡 알림 제공을 위해 이름, 닉네임, 전화번호,
                이메일 등의 정보를 수집합니다.
              </p>
              <details className="mt-2 text-xs leading-6 text-slate-300">
                <summary className="cursor-pointer select-none text-slate-200">
                  자세히 보기
                </summary>
                <div className="mt-2 space-y-2">
                  <p>
                    수집 항목: 이름, 닉네임, 전화번호, 이메일 주소, 비밀번호, 관심 상품
                    정보, 알림 설정 정보, 알림 발송 이력
                  </p>
                  <p>
                    이용 목적: 회원 식별 및 계정 관리, 가격 추적 서비스 제공, 웹/카카오톡
                    알림 발송, 서비스 운영 및 부정 이용 방지
                  </p>
                  <p>
                    보유 기간: 회원 탈퇴 시까지 보관하며, 관련 법령 또는 내부 운영 정책에
                    따라 일부 정보는 일정 기간 추가 보관될 수 있습니다.
                  </p>
                  <p>
                    카카오톡 알림 기능을 사용하는 경우, 알림 발송을 위해 전화번호 및
                    카카오 연계 정보가 필요한 범위 내에서 처리될 수 있습니다.
                  </p>
                  <p>
                    귀하는 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있으나, 필수
                    항목에 동의하지 않을 경우 회원가입 및 알림 서비스 이용이 제한될 수
                    있습니다.
                  </p>
                </div>
              </details>
            </div>
          </label>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}
        <button
          type="submit"
          disabled={loading || isPasswordMismatch}
          className="w-full rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? "가입 중..." : "회원가입"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-300">
        이미 계정이 있으신가요?{" "}
        <Link href="/auth/login" className="text-emerald-400 underline">
          로그인
        </Link>
      </p>
    </div>
  );
}

