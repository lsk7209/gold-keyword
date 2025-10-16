# 배포 가이드

## 🚀 Vercel 배포

### 1. 사전 준비

#### Supabase 프로젝트 생성
1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트 URL과 API 키 확인
3. SQL Editor에서 `scripts/schema.sql` 실행

#### 네이버 API 키 준비
- **검색광고 API**: RelKwdStat 사용을 위한 키
- **오픈API**: 블로그/카페/웹/뉴스 검색을 위한 키

### 2. Vercel 배포

#### GitHub 연동
```bash
# 1. GitHub에 코드 푸시
git add .
git commit -m "Initial commit"
git push origin main

# 2. Vercel에서 프로젝트 연결
# - https://vercel.com/dashboard
# - "New Project" 클릭
# - GitHub 저장소 선택
# - "Import" 클릭
```

#### 환경변수 설정
Vercel 대시보드에서 다음 환경변수를 설정:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 서버 보안
SERVER_TOKEN=your_secure_random_token
CRON_SECRET=your_cron_secret

# 네이버 오픈API 키 (JSON 배열)
NAVER_OPENAPI_KEYS='[
  {
    "label": "open-1",
    "clientId": "your_client_id_1",
    "clientSecret": "your_client_secret_1",
    "qps": 3,
    "daily": 20000
  }
]'

# 네이버 검색광고 API 키 (JSON 배열)
NAVER_SEARCHAD_KEYS='[
  {
    "label": "ad-1",
    "accessLicense": "your_access_license_1",
    "secret": "your_secret_1",
    "customerId": "your_customer_id_1",
    "qps": 0.5,
    "daily": 8000
  }
]'
```

### 3. Cron 작업 설정

Vercel에서 자동으로 Cron 작업이 설정됩니다:

- **연관키워드 수집**: 5분마다 (`/api/collect/related`)
- **문서수 집계**: 10분마다 (`/api/collect/docs`)

### 4. 배포 후 확인

#### 헬스 체크
```bash
curl -H "Authorization: Bearer YOUR_SERVER_TOKEN" \
  https://your-app.vercel.app/api/admin/health
```

#### API 키 초기화
```bash
# API 키를 데이터베이스에 동기화
curl -X POST https://your-app.vercel.app/api/admin/init-keys \
  -H "Authorization: Bearer YOUR_SERVER_TOKEN"
```

## 🔧 로컬 개발

### 1. 환경 설정
```bash
# 의존성 설치
npm install

# 환경변수 설정
cp env.example .env.local
# .env.local 파일 편집

# 개발 서버 시작
npm run dev
```

### 2. 데이터베이스 설정
```sql
-- Supabase SQL Editor에서 실행
-- scripts/schema.sql 파일의 내용 복사 후 실행
```

### 3. API 키 초기화
```bash
# 환경변수의 API 키를 데이터베이스에 동기화
npm run db:seed-keys
```

## 📊 모니터링

### 헬스 대시보드
- URL: `https://your-app.vercel.app/admin`
- API 키 상태, 레이트 리미터, 작업 큐 모니터링

### 주요 지표
- **429 에러율**: < 5%/시간
- **평균 대기시간**: < 60초
- **처리량**: related ≥ 60/min, docs ≥ 200/min

### 알림 설정
- Vercel에서 함수 오류 알림 설정
- Supabase에서 데이터베이스 오류 알림 설정

## 🚨 문제 해결

### 일반적인 문제

#### 1. API 키 오류
```bash
# API 키 상태 확인
curl -H "Authorization: Bearer YOUR_SERVER_TOKEN" \
  https://your-app.vercel.app/api/admin/health
```

#### 2. 데이터베이스 연결 오류
- Supabase 프로젝트 URL과 키 확인
- RLS 정책 확인
- 네트워크 연결 확인

#### 3. Cron 작업 미실행
- Vercel 대시보드에서 Cron 작업 상태 확인
- 환경변수 `CRON_SECRET` 설정 확인
- 함수 타임아웃 설정 확인

#### 4. 레이트 리미트 초과
- API 키 추가
- QPS 설정 조정
- 배치 크기 감소

### 로그 확인
```bash
# Vercel 함수 로그
vercel logs

# Supabase 로그
# Supabase 대시보드 > Logs
```

## 🔄 업데이트 배포

### 코드 업데이트
```bash
# 1. 코드 수정
git add .
git commit -m "Update: description"
git push origin main

# 2. Vercel 자동 배포 확인
# Vercel 대시보드에서 배포 상태 확인
```

### 환경변수 업데이트
1. Vercel 대시보드 > Settings > Environment Variables
2. 변수 수정 후 "Save" 클릭
3. 새 배포 트리거

### 데이터베이스 마이그레이션
```sql
-- Supabase SQL Editor에서 실행
-- scripts/migration.sql 파일의 내용 실행
```

## 📈 성능 최적화

### 1. API 키 최적화
- 키 수 증가 (권장: 3-5개)
- QPS 설정 조정
- 일일 쿼터 모니터링

### 2. 데이터베이스 최적화
- 인덱스 추가
- 파티셔닝 적용
- 정기적인 통계 업데이트

### 3. 함수 최적화
- 배치 크기 조정
- 타임아웃 설정
- 메모리 사용량 모니터링

## 🔒 보안

### API 보안
- 서버 토큰 정기 변경
- API 키 암호화 저장
- RLS 정책 적용

### 접근 제어
- 관리자 페이지 접근 제한
- API 엔드포인트 보호
- 로그 모니터링

## 📞 지원

문제가 발생하면:
1. 로그 확인
2. 헬스 체크 실행
3. GitHub Issues 생성
4. 문서 참조
