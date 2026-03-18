## Supabase 실제 연결 가이드

### 1. 현재 상태

- 웹 앱은 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 사용해
  **실제 Supabase 프로젝트에 연결**하도록 구성되어 있습니다.
- 다만, 원격 Supabase 프로젝트에 **테이블/트리거/RLS 스키마를 아직 적용하지 않았다면**
  로그인 이후 API 호출 시 테이블 없음 오류가 발생할 수 있습니다.

### 2. 가장 먼저 할 일

Supabase Dashboard의 **SQL Editor**에서 아래 마이그레이션 파일을 실행하세요.

- `supabase/migrations/0001_initial_schema.sql`

이 파일에는 다음이 포함되어 있습니다.

- `profiles`, `products`, `favorites`, `price_history`, `alert_rules`, `notifications`, `push_tokens`, `kakao_links`
- 회원가입 시 `profiles`를 자동 생성하는 trigger/function
- 회원가입 시 입력한 `nickname`을 `profiles.nickname`으로 자동 반영하는 로직
- 사용자 데이터 보호용 RLS 정책
- 사용자 역할 구분용 `profiles.role` (`user`, `admin`)
- 알림 기준가 저장용 `alert_rules.baseline_price`

### 3. 로컬 환경 변수 확인

`web/.env.local`에 아래 값이 있어야 합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

### 4. DB 연결 확인

아래 명령으로 실제 원격 Supabase와 최소 연결 상태를 확인할 수 있습니다.

```bash
cd web
npm run db:check
```

성공 시:

- `DB 연결 성공: products 테이블 접근이 가능합니다.`

실패 시 대표 원인:

- `products 테이블이 없습니다`
  - 마이그레이션을 아직 적용하지 않음
- `권한 문제가 있습니다`
  - 권한/RLS/GRANT 설정 문제

### 5. 로그인 후 확인할 것

1. 회원가입
2. 이메일 인증
3. 로그인
4. `/dashboard` 진입

정상이라면:

- `profiles` 자동 생성
- 회원가입 시 입력한 닉네임이 `profiles.nickname`에 저장
- `profiles.role` 기본값이 `user`
- `/api/me` 응답 정상
- `/api/favorites`, `/api/alert-rules` 호출 시 테이블 오류 없음
- 등록가 기준 `하락` / `변동` 알림 저장 가능

### 6. 관리자 계정 승격

초기 가입자는 기본적으로 `user`로 생성됩니다.
특정 사용자를 관리자로 변경하려면 SQL Editor에서 아래처럼 실행합니다.

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

### 7. 참고

- 현재 레포에는 **Supabase CLI 링크 상태**가 아직 없습니다.
- 그래서 원격 반영은 우선 **SQL Editor 직접 실행 방식**을 기준으로 진행합니다.
- 나중에 CLI를 붙이면 `db push`, 타입 생성, 함수 배포까지 자동화할 수 있습니다.

