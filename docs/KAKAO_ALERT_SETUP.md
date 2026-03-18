## 카카오 알림톡 준비 가이드

### 1. 기준 발송 경로

현재 프로젝트는 **카카오 비즈메시지 직접 연동** 기준으로 카카오 알림을 발송합니다.

직접 연동 기준:

- 카카오 OAuth 토큰 발급 후 알림톡 발송 API를 바로 호출
- 발송 대행사 없이 카카오 비즈메시지 계약 정보로 운영
- 서비스 구조를 단순하게 유지

### 2. 먼저 준비할 것

1. 카카오톡 채널 개설 및 비즈니스 채널 전환
2. 카카오 비즈메시지 사용 계약
3. 알림톡 템플릿 심사 요청
4. 발송용 발신번호 등록
5. 계약 후 발급되는 직접 연동 정보 확보

필요한 값:

- `KAKAO_BIZ_BASE_URL`
- `KAKAO_BIZ_CLIENT_ID`
- `KAKAO_BIZ_CLIENT_SECRET`
- `KAKAO_BIZ_SENDER_KEY`
- `KAKAO_BIZ_TEMPLATE_CODE_PRICE_ALERT`
- `KAKAO_BIZ_SENDER_NO`

운영 일반 계열 기본 URL 예시:

- `https://bizmsg-web.kakaoenterprise.com`

### 3. 템플릿 준비

카카오 알림톡은 승인된 템플릿으로만 발송할 수 있습니다.

가격 알림용 추천 템플릿 예시:

```text
[Price Ping]
#{상품명} 가격이 #{현재가격}원으로 변경되었습니다.
설정한 조건: #{조건명}
상품 보기: #{상품링크}
```

주의:

- 템플릿 변수명은 승인된 템플릿과 정확히 일치해야 합니다.
- 실제 발송 메시지는 승인된 템플릿 문구와 동일한 구조여야 합니다.
- 알림톡은 정보성 메시지여야 하며 광고성 문구를 넣으면 안 됩니다.

### 4. 개인정보/동의 구조

추천 기준:

- 회원가입 필수:
  - 이름
  - 닉네임
  - 이메일
  - 비밀번호
  - 개인정보 수집 및 이용 동의
- 선택:
  - 전화번호
  - 카카오톡 알림 수신 동의

카카오 알림을 사용하지 않는 사용자는 전화번호를 제공하지 않아도 기본 서비스 이용이 가능해야 합니다.

### 5. `.env.local` 또는 배포 환경 변수

```env
KAKAO_BIZ_BASE_URL=https://bizmsg-web.kakaoenterprise.com
KAKAO_BIZ_CLIENT_ID=
KAKAO_BIZ_CLIENT_SECRET=
KAKAO_BIZ_SENDER_KEY=
KAKAO_BIZ_TEMPLATE_CODE_PRICE_ALERT=
KAKAO_BIZ_SENDER_NO=
```

### 6. 현재 프로젝트에서 구현된 범위

- 카카오 OAuth 토큰 발급 모듈
- 카카오 알림톡 직접 발송 모듈
- 서버용 가격 알림 발송 함수
- 관리자 테스트 발송 API
- `notifications` 테이블 기록

관리자 테스트 발송 API:

- `POST /api/admin/kakao/test`

예시 요청:

```json
{
  "to": "01012345678",
  "title": "테스트 상품",
  "price": 99000,
  "condition_label": "목표가 도달",
  "product_url": "https://example.com/product"
}
```

또는 사용자 ID 기반 테스트:

```json
{
  "user_id": "user-uuid",
  "product_id": 1,
  "title": "테스트 상품",
  "price": 99000,
  "condition_label": "목표가 도달",
  "product_url": "https://example.com/product"
}
```

### 7. 실제 연동 전 체크리스트

- 카카오 채널 연결 완료
- 알림톡 템플릿 승인 완료
- 발신번호 등록 완료
- Client ID/Secret 발급 완료
- 테스트 수신번호로 실제 발송 성공 확인

### 8. API 호출 흐름

1. `POST /v2/oauth/token` 으로 액세스 토큰 발급
2. `POST /v2/send/kakao` 로 알림톡 발송
3. 발송 결과를 `notifications` 테이블에 기록

### 9. 이후 연결 순서

1. 테스트 발송 성공
2. 가격 조건 만족 시 서버 발송 함수 호출
3. 실패 로그/재시도 정책 보강
4. 운영 템플릿 추가
