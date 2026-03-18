import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    throw new Error(`환경 변수 파일이 없습니다: ${envPath}`);
  }

  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = value.replace(/^['"]|['"]$/g, "");
  }

  return env;
}

async function main() {
  const envPath = path.join(process.cwd(), ".env.local");
  const env = loadEnvFile(envPath);

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 설정되지 않았습니다."
    );
  }

  const supabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log("Supabase 연결을 확인합니다...");

  const { error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });

  if (error?.code === "42P01") {
    throw new Error(
      "DB 연결은 되었지만 products 테이블이 없습니다. Supabase SQL Editor에서 마이그레이션을 먼저 적용해주세요."
    );
  }

  if (error?.code === "42501") {
    throw new Error(
      "DB 연결은 되었지만 권한 문제가 있습니다. 테이블 권한 또는 RLS/GRANT 설정을 확인해주세요."
    );
  }

  if (error) {
    throw new Error(`DB 확인 실패: ${error.message}`);
  }

  console.log("DB 연결 성공: products 테이블 접근이 가능합니다.");

  const { error: profileError } = await supabase
    .from("profiles")
    .select("role", { count: "exact", head: true });

  if (profileError?.code === "42703") {
    throw new Error(
      "DB 연결은 되었지만 profiles.role 컬럼이 없습니다. 0001_initial_schema.sql 최신 버전을 적용해주세요."
    );
  }

  if (profileError?.code === "42501") {
    throw new Error(
      "DB 연결은 되었지만 권한 문제가 있습니다. 테이블 권한 또는 RLS/GRANT 설정을 확인해주세요."
    );
  }

  if (profileError) {
    throw new Error(`DB 확인 실패: ${profileError.message}`);
  }

  console.log("역할 컬럼 확인 성공: profiles.role 접근이 가능합니다.");

  const { error: approvalError } = await supabase
    .from("profiles")
    .select("approval_status", { count: "exact", head: true });

  if (approvalError?.code === "42703") {
    throw new Error(
      "DB 연결은 되었지만 profiles.approval_status 컬럼이 없습니다. 최신 0001_initial_schema.sql 기준으로 컬럼을 추가해주세요."
    );
  }

  if (approvalError?.code === "42501") {
    throw new Error(
      "DB 연결은 되었지만 권한 문제가 있습니다. 테이블 권한 또는 RLS/GRANT 설정을 확인해주세요."
    );
  }

  if (approvalError) {
    throw new Error(`DB 확인 실패: ${approvalError.message}`);
  }

  console.log("승인 상태 컬럼 확인 성공: profiles.approval_status 접근이 가능합니다.");

  const { error: alertRuleError } = await supabase
    .from("alert_rules")
    .select("baseline_price", { count: "exact", head: true });

  if (!alertRuleError) {
    console.log("알림 기준가 컬럼 확인 성공: alert_rules.baseline_price 접근이 가능합니다.");
    return;
  }

  if (alertRuleError.code === "42703") {
    throw new Error(
      "DB 연결은 되었지만 alert_rules.baseline_price 컬럼이 없습니다. 최신 0001_initial_schema.sql 기준으로 컬럼을 추가해주세요."
    );
  }

  if (alertRuleError.code === "42501") {
    throw new Error(
      "DB 연결은 되었지만 권한 문제가 있습니다. 테이블 권한 또는 RLS/GRANT 설정을 확인해주세요."
    );
  }

  throw new Error(`DB 확인 실패: ${alertRuleError.message}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

