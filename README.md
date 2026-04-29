# Price Ping

가격 변동 알림 서비스 - 관심 상품의 가격을 자동으로 추적하고, 설정한 조건에 맞으면 앱/카카오톡으로 바로 알려줍니다.

## 주요 기능

- 상품 URL 등록 및 즐겨찾기 관리 (네이버 스토어 중심)
- 가격 모니터링 및 목표 가격 설정
- 조건 만족 시 푸시 알림 및 카카오톡 알림 발송
- 웹/PWA 지원으로 모바일/데스크톱에서 사용 가능

## 기술 스택

- **Frontend**: Next.js (React, TypeScript), PWA
- **Backend**: Supabase (Postgres, Auth, Edge Functions)
- **크롤링**: Cheerio, Puppeteer (필요 시)
- **알림**: 브라우저 푸시 API, 카카오 비즈메시지 API

## 설치 및 실행

### 사전 요구사항

- Node.js 18+
- Supabase 계정 및 프로젝트 설정

### 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정 (.env.local)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
```

### 실행

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start
```

## 문서

- [기획 문서](docs/PLAN.md)
- [API 스펙](docs/API_SPEC.md)
- [DB 스키마](docs/DB_SCHEMA.md)
- [Supabase 설정](docs/SUPABASE_SETUP.md)
- [카카오 알림 설정](docs/KAKAO_ALERT_SETUP.md)
- [TestFlight 설정](docs/TESTFLIGHT_SETUP.md)
- [와이어프레임](docs/WIREFRAMES.md)

## 라이선스

MIT License