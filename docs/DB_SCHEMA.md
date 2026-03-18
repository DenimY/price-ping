## DB 설계 문서 (Supabase / Postgres)

### 1. 개요

- **목표**: Price Ping 서비스에서 필요한 최소한의 DB 스키마 정의
- **기반**: Supabase(Postgres + Auth + RLS)

### 2. 테이블 목록

- `profiles` – 사용자 프로필 (Supabase Auth 확장)
- `products` – 상품 정보
- `favorites` – 사용자 즐겨찾기
- `price_history` – 가격 히스토리
- `alert_rules` – 알림 조건
- `notifications` – 알림 로그
- `push_tokens` – 푸시 토큰
- `kakao_links` – 카카오 연동 정보

---

### 3. 테이블 상세

#### 3.1 `profiles`

- **설명**: Supabase `auth.users`를 확장하는 사용자 프로필

| 컬럼        | 타입      | 설명                                |
|------------|-----------|-------------------------------------|
| id         | uuid PK   | `auth.users.id`와 1:1 매핑          |
| email      | text      | 사용자 이메일 (unique)              |
| full_name  | text      | 이름                                |
| nickname   | text      | 닉네임                              |
| phone_number | text    | 전화번호 (선택)                     |
| privacy_consent | boolean | 개인정보 수집 및 이용 동의 여부   |
| privacy_consent_at | timestamptz | 개인정보 동의 시각         |
| kakao_alert_consent | boolean | 카카오 알림 수신 동의 여부   |
| kakao_alert_consent_at | timestamptz | 카카오 동의 시각       |
| role       | text      | 사용자 역할 (`user`, `admin`)       |
| created_at | timestamptz | 생성 시각                         |
| updated_at | timestamptz | 수정 시각                         |

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  nickname text,
  phone_number text,
  privacy_consent boolean default false,
  privacy_consent_at timestamptz,
  kakao_alert_consent boolean default false,
  kakao_alert_consent_at timestamptz,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### 3.2 `products`

- **설명**: 네이버 스토어(및 기타 몰) 상품 정보

| 컬럼           | 타입        | 설명                                   |
|----------------|-------------|----------------------------------------|
| id             | bigint PK   | 상품 ID (identity)                    |
| url            | text        | 상품 URL (unique)                     |
| mall           | text        | 쇼핑몰 구분 (`naver_store`, `naver_plus_store`, `coupang` 등) |
| title          | text        | 상품명                                |
| image_url      | text        | 대표 이미지 URL                       |
| currency       | text        | 통화 (기본 `KRW`)                     |
| last_price     | bigint      | 마지막으로 수집한 가격                |
| last_checked_at| timestamptz | 마지막 가격 체크 시각                 |
| created_at     | timestamptz | 생성 시각                             |
| updated_at     | timestamptz | 수정 시각                             |

```sql
create table public.products (
  id bigint generated always as identity primary key,
  url text not null unique,
  mall text not null default 'naver_store',
  title text,
  image_url text,
  currency text default 'KRW',
  last_price bigint,
  last_checked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### 3.3 `favorites`

- **설명**: 사용자별 관심 상품(즐겨찾기)

| 컬럼        | 타입        | 설명                             |
|------------|-------------|----------------------------------|
| id         | bigint PK   | 즐겨찾기 ID                      |
| user_id    | uuid FK     | `auth.users.id`                  |
| product_id | bigint FK   | `products.id`                    |
| memo       | text        | 메모                             |
| created_at | timestamptz | 생성 시각                        |

```sql
create table public.favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  memo text,
  created_at timestamptz default now(),
  unique (user_id, product_id)
);
```

#### 3.4 `price_history`

- **설명**: 가격 변동 이력(그래프용)

| 컬럼        | 타입        | 설명                    |
|------------|-------------|-------------------------|
| id         | bigint PK   | 히스토리 ID             |
| product_id | bigint FK   | `products.id`           |
| price      | bigint      | 가격                     |
| checked_at | timestamptz | 가격 체크 시각          |

```sql
create table public.price_history (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  price bigint not null,
  checked_at timestamptz not null default now()
);

create index idx_price_history_product_time
  on public.price_history (product_id, checked_at desc);
```

#### 3.5 `alert_rules`

- **설명**: 사용자별 상품 가격 알림 설정

| 컬럼             | 타입        | 설명                                    |
|------------------|-------------|-----------------------------------------|
| id               | bigint PK   | 알림 규칙 ID                            |
| user_id          | uuid FK     | `auth.users.id`                         |
| product_id       | bigint FK   | `products.id`                           |
| type             | text        | `target_price`, `drop_percentage` 등    |
| target_price     | bigint      | 목표 가격 (type이 `target_price`일 때) |
| change_percentage| numeric     | 변화율 (type이 % 기반일 때)            |
| active           | boolean     | 활성 여부                               |
| last_triggered_at| timestamptz | 마지막 발송 시각                        |
| created_at       | timestamptz | 생성 시각                               |
| updated_at       | timestamptz | 수정 시각                               |

```sql
create table public.alert_rules (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  type text not null,
  target_price bigint,
  change_percentage numeric,
  active boolean default true,
  last_triggered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_alert_rules_active
  on public.alert_rules (active, product_id);
```

#### 3.6 `notifications`

- **설명**: 발송된 알림 기록

| 컬럼          | 타입        | 설명                                 |
|--------------|-------------|--------------------------------------|
| id           | bigint PK   | 알림 ID                              |
| user_id      | uuid FK     | `auth.users.id`                      |
| product_id   | bigint FK   | `products.id`                        |
| alert_rule_id| bigint FK   | `alert_rules.id` (nullable)          |
| channel      | text        | `web_push`, `kakao` 등               |
| title        | text        | 알림 제목                            |
| message      | text        | 알림 내용                            |
| sent_at      | timestamptz | 실제 발송 시각                       |
| status       | text        | `pending`, `sent`, `failed` 등       |
| error_message| text        | 실패 시 에러 메시지                  |

```sql
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  alert_rule_id bigint references public.alert_rules(id) on delete set null,
  channel text not null,
  title text,
  message text,
  sent_at timestamptz,
  status text default 'pending',
  error_message text
);

create index idx_notifications_user_time
  on public.notifications (user_id, sent_at desc);
```

#### 3.7 `push_tokens`

- **설명**: 웹/앱 푸시 토큰

| 컬럼        | 타입        | 설명                           |
|------------|-------------|--------------------------------|
| id         | bigint PK   | 토큰 ID                        |
| user_id    | uuid FK     | `auth.users.id`                |
| token      | text        | FCM/Web Push 토큰              |
| platform   | text        | `web`, `ios`, `android` 등     |
| created_at | timestamptz | 생성 시각                      |

```sql
create table public.push_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null,
  created_at timestamptz default now(),
  unique (user_id, token)
);
```

#### 3.8 `kakao_links`

- **설명**: 사용자와 카카오 계정 매핑 정보

| 컬럼         | 타입        | 설명                             |
|-------------|-------------|----------------------------------|
| id          | bigint PK   | 링크 ID                          |
| user_id     | uuid FK     | `auth.users.id`                  |
| kakao_user_id | text      | 카카오 측 사용자 식별자          |
| created_at  | timestamptz | 생성 시각                        |

```sql
create table public.kakao_links (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kakao_user_id text not null,
  created_at timestamptz default now(),
  unique (kakao_user_id),
  unique (user_id)
);
```

---

### 4. RLS 요약 (별도 문서에서 상세 정의 가능)

- `profiles`
  - 기본적으로 로그인한 사용자 본인 행만 조회/수정 가능
  - `role = 'admin'` 사용자는 전체 프로필 조회/수정 가능하도록 확장 가능
- `favorites`, `alert_rules`, `notifications`, `push_tokens`, `kakao_links`:
  - 공통: `user_id = auth.uid()` 조건으로 select/insert/update/delete 제한
- 자세한 정책 SQL은 필요 시 `docs/RLS_POLICIES.md`로 분리 예정

### 5. 사용자 권한 모델

- **일반 유저 (`user`)**
  - 서비스 기본 사용자
  - 본인 계정, 즐겨찾기, 알림 규칙, 알림 로그만 접근 가능

- **관리자 유저 (`admin`)**
  - 운영 목적 계정
  - 초기 버전에서는 우선 `profiles` 기준 관리 권한만 반영
  - 향후 관리자 전용 화면/운영 API 추가 시 권한 범위를 넓힐 예정

