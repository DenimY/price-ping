## TestFlight 준비 가이드

### 1. 현재 구조

- 웹 서비스는 `web/`의 Next.js 앱으로 유지합니다.
- iPhone 앱은 `web/ios/`의 Capacitor iOS 셸을 사용합니다.
- 실제 앱 화면은 배포된 웹앱 URL을 로드하는 구조입니다.

### 2. 선행 조건

- Apple Developer 계정
- Xcode 설치
- 실제 접속 가능한 배포 URL
- Supabase 환경 변수 및 DB 스키마 적용 완료

### 3. 배포 URL 준비

먼저 웹앱을 외부에서 접속 가능한 URL로 배포해야 합니다.

예시:

- `https://price-ping-web.vercel.app`

웹앱 자체도 같은 공개 URL을 알아야 하므로 `.env.local` 또는 배포 환경 변수에 아래 값을 함께 설정합니다.

```env
NEXT_PUBLIC_SITE_URL=https://price-ping-web.vercel.app
NEXT_PUBLIC_APP_URL_SCHEME=priceping
```

이 값은 회원가입 이메일 인증 링크를 `/auth/callback`으로 복귀시키는 데 사용됩니다.

- 웹 브라우저 가입: `NEXT_PUBLIC_SITE_URL/auth/callback`
- iPhone 앱 가입: `priceping://auth/callback`

### 4. Capacitor 서버 URL 설정

`Capacitor`는 `.env.local`의 `CAPACITOR_SERVER_URL` 값을 읽어 앱에서 열 웹 주소를 결정합니다.

`.env.local` 예시:

```env
CAPACITOR_SERVER_URL=https://price-ping-web.vercel.app
```

설정 후 동기화:

```bash
cd web
npm run cap:sync:ios
```

개발 중 로컬 점검 예시:

```env
CAPACITOR_SERVER_URL=http://192.168.0.10:3001
```

```bash
cd web
npm run cap:sync:ios
```

### 5. iOS 프로젝트 열기

```bash
cd web
npm run cap:open:ios
```

이후 Xcode에서 아래를 설정합니다.

- Signing Team
- Bundle Identifier: `com.denimy.priceping`
- 앱 아이콘
- 버전/빌드 번호

### 6. 실제 기기 확인 항목

- 앱 실행 시 웹앱이 정상 로드되는지
- 로그인/로그아웃
- 회원가입
- 이메일 인증 후 `priceping://auth/callback`으로 앱 복귀되는지
- 대시보드 진입
- 상품 등록
- 외부 링크 열기

### 7. TestFlight 업로드

Xcode에서:

1. `Any iOS Device` 선택
2. `Product > Archive`
3. `Distribute App`
4. `App Store Connect`
5. `Upload`

업로드 완료 후 App Store Connect에서 TestFlight 내부 테스터 배포를 진행합니다.

### 8. 현재 한계

- 네이티브 푸시는 아직 연결되지 않았습니다.
- 앱은 현재 배포된 웹앱을 로드하는 구조입니다.
- App Store 정식 심사 대응은 TestFlight 검증 이후 별도로 진행하는 것이 좋습니다.
