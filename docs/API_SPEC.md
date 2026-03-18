## API 설계 문서 (초안)

### 1. 개요

- **목표**: 프론트엔드(Next.js)와 백엔드(Supabase/Edge Functions) 간의 주요 API 인터페이스 정의
- **스타일**: REST 기반, JSON 응답

> 인증/인가 자체는 **Supabase Auth + JS SDK**를 활용하고,  
> 비즈니스 로직이 필요한 부분은 Supabase Edge Functions 또는 Next.js API Route로 구현.

---

### 2. 인증 / 프로필

인증은 Supabase Auth를 사용하되, 아래 정책에 따라 동작합니다.

- **회원가입 / 로그인 (이메일 + 비밀번호)**  
  - Supabase JS SDK 사용 (`signUp`, `signInWithPassword`)
  - 회원가입 시:
    - 이메일, 비밀번호를 받아 Supabase `signUp` 호출
    - Supabase가 **이메일 검증 메일**을 발송
    - 이메일 내 링크를 클릭해야 계정 활성화(이전까지는 제한된 상태)
  - 로그인 시:
    - `signInWithPassword` 사용

- **소셜 로그인 (향후 확장 예정)**  
  - 초기 버전에서는 제공하지 않으며,
  - 추후 도입 시 별도 섹션에서 OAuth 플로우 및 콜백 API를 정의.

- **비밀번호 재설정**
  - “비밀번호 찾기”에서:
    - Supabase `resetPasswordForEmail` 호출로 재설정 링크 메일 발송
  - 재설정 링크 페이지:
    - 새 비밀번호 입력 후 Supabase SDK를 통해 업데이트

- **내 프로필 조회**
  - `GET /api/me`
  - **설명**: 현재 로그인한 사용자의 프로필 정보 반환
  - **응답 예시**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "nickname": "홍길동",
  "role": "user",
  "created_at": "2026-03-18T00:00:00Z"
}
```

- **권한 모델**
  - `role = "user"`: 일반 사용자
  - `role = "admin"`: 관리자 사용자
  - 초기 버전의 일반 API는 대부분 일반 유저 기준으로 동작하며, 관리자 전용 API는 추후 추가

---

### 3. 상품 / 즐겨찾기

#### 3.1 상품 URL 등록

- `POST /api/products/parse-and-add`
- **설명**: 네이버 스마트스토어 또는 네이버플러스 스토어 상품 URL을 전달하면, 상품 정보를 파싱해 `products`에 저장하고, 해당 상품 정보를 반환
- **요청 바디**

```json
{
  "url": "https://smartstore.naver.com/... 또는 https://shopping.naver.com/..."
}
```

- **응답 예시**

```json
{
  "product": {
    "id": 1,
    "url": "https://smartstore.naver.com/...",
    "mall": "naver_store",
    "title": "상품명",
    "image_url": "https://...",
    "currency": "KRW",
    "last_price": 123456,
    "last_checked_at": "2026-03-18T00:00:00Z"
  }
}
```

- **지원 mall 값**
  - `naver_store`: 네이버 스마트스토어
  - `naver_plus_store`: 네이버플러스 스토어

#### 3.2 즐겨찾기 추가

- `POST /api/favorites`
- **설명**: 특정 상품을 내 즐겨찾기에 추가
- **요청 바디**

```json
{
  "product_id": 1,
  "memo": "메모(optional)"
}
```

- **응답 예시**

```json
{
  "favorite": {
    "id": 10,
    "product_id": 1,
    "memo": "메모",
    "created_at": "2026-03-18T00:00:00Z"
  }
}
```

#### 3.3 내 즐겨찾기 목록 조회

- `GET /api/favorites`
- **설명**: 로그인한 사용자의 즐겨찾기 + 상품 요약 정보

```json
[
  {
    "favorite_id": 10,
    "product_id": 1,
    "product_title": "상품명",
    "product_image_url": "https://...",
    "last_price": 123456,
    "target_price": 100000,
    "alert_active": true
  }
]
```

#### 3.4 즐겨찾기 삭제

- `DELETE /api/favorites/:id`
- **설명**: 해당 즐겨찾기 삭제(소프트 삭제 여부는 추후 결정)

---

### 4. 알림 설정 (Alert Rules)

#### 4.1 알림 규칙 생성/수정

- `POST /api/alert-rules`
- **설명**: 특정 상품에 대한 목표 가격 알림 규칙 생성 또는 수정
- **요청 바디**

```json
{
  "product_id": 1,
  "type": "target_price",
  "target_price": 100000,
  "active": true
}
```

- **응답 예시**

```json
{
  "alert_rule": {
    "id": 5,
    "product_id": 1,
    "type": "target_price",
    "target_price": 100000,
    "active": true
  }
}
```

#### 4.2 내 알림 규칙 목록

- `GET /api/alert-rules`

```json
[
  {
    "id": 5,
    "product_id": 1,
    "type": "target_price",
    "target_price": 100000,
    "active": true,
    "last_triggered_at": "2026-03-18T00:00:00Z"
  }
]
```

---

### 5. 가격 히스토리

#### 5.1 특정 상품 가격 히스토리

- `GET /api/products/:id/price-history?limit=50`

```json
[
  {
    "price": 120000,
    "checked_at": "2026-03-17T10:00:00Z"
  },
  {
    "price": 110000,
    "checked_at": "2026-03-18T10:00:00Z"
  }
]
```

---

### 6. 알림 / 로그

#### 6.1 내 알림 로그 조회

- `GET /api/notifications?limit=50`

```json
[
  {
    "id": 100,
    "product_id": 1,
    "alert_rule_id": 5,
    "channel": "web_push",
    "title": "목표 가격 도달!",
    "message": "상품명 가격이 100,000원 이하로 내려갔습니다.",
    "sent_at": "2026-03-18T12:00:00Z",
    "status": "sent"
  }
]
```

---

### 7. 푸시 / 카카오 연동 (요약)

#### 7.1 푸시 토큰 등록

- `POST /api/push-tokens`

```json
{
  "token": "web-or-fcm-token",
  "platform": "web"
}
```

#### 7.2 카카오 연동 콜백 (예시)

- `POST /api/kakao/callback`
- 카카오 OAuth/토큰 교환 후 `kakao_links` 테이블에 `kakao_user_id`를 저장하기 위한 엔드포인트

---

### 8. 내부용 Edge Function & 스케줄링 (가격 체크)

> 실제로는 Supabase Edge Functions 코드이며, 외부에 바로 노출되지 않는 내부 API입니다.

- **함수 이름 예시**: `price-checker`

- **스케줄링 소스**
  - 기본: **Supabase Scheduled Functions(크론)** 을 사용해 정기 실행.
    - 예: 1시간마다 실행 `cron: "0 * * * *"`.
  - 한도/요구사항에 따라:
    - 외부 스케줄러(Cloudflare Workers, GitHub Actions, 별도 서버 cron 등)가 HTTP로 해당 Edge Function을 호출하는 구조로 확장 가능.

- **흐름(리스크 고려 버전)**
  1. `products` 테이블에서 **모니터링 대상 상품 목록을 제한적으로 조회**
     - 유저당 최대 관심 상품 수, 배치당 최대 처리 건수, 상품별 최소 체크 간격(예: 1~3시간) 등을 고려하여 쿼리
  2. 각 상품의 현재 가격 크롤링 시,
     - 요청 사이에 **지연(예: 500–1000ms)** 삽입
     - HTTP 상태 코드 확인(특히 403/429) 후, 필요한 경우 **백오프 및 재시도 횟수 제한**
  3. 가격 파싱
     - DOM 구조 변경에 대비해 **여러 셀렉터를 순차적으로 시도(fallback)** 
     - 가격 파싱 실패 시:
       - `price_history`에 잘못된 값 저장하지 않음
       - 별도 에러 상태/로그를 남겨 실패율 모니터링
  4. 파싱 성공 시:
     - `price_history`에 기록, `products.last_price` 및 `last_checked_at` 업데이트
  5. 관련된 `alert_rules` 조회 → 조건 만족 시:
     - `notifications` 레코드 생성
     - 푸시/카카오 발송 로직 호출 (각 채널별 전송 실패 시 에러 기록)

- **장애/실패 처리**
  - Edge Function 호출 자체 실패:
    - Supabase 로그에서 오류 확인.
    - 추후 외부 모니터링 도구(Sentry 등)와 연동해 장애 알림 도입 예정.
  - 개별 상품 단위 실패:
    - 해당 상품의 실패 이유/횟수를 로그 또는 별도 테이블에 기록.
    - 동일 상품 N회(예: 3회) 연속 실패 시, 다음 크롤링을 더 늦추고 UI에서 “일시적 장애” 상태로 노출.

