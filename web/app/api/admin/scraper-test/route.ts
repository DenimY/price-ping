import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile, isAdminProfile } from "@/lib/accessControl";
import { normalizeInputUrl } from "@/lib/mall";
import { runScraperTest } from "@/lib/scrapers";

export async function POST(request: NextRequest) {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminProfile(profile)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    url?: string;
  };

  const url = body.url ? normalizeInputUrl(body.url) : "";

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const result = await runScraperTest(url);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "스크래퍼 테스트 중 오류가 발생했습니다."
      },
      { status: 500 }
    );
  }
}
