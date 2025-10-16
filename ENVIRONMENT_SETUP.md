# 환경변수 설정 가이드

## 📋 필수 환경변수 목록

### 1. Supabase 설정
```bash
# Supabase 프로젝트 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. 네이버 API 키 설정

#### 검색광고 API (RelKwdStat)
```bash
# JSON 형식으로 여러 키 설정 가능
NAVER_SEARCHAD_KEYS='[
  {
    "label": "ad-key-1",
    "accessLicense": "your-access-license-1",
    "secret": "your-secret-1", 
    "customerId": "your-customer-id-1",
    "qps": 0.5,
    "daily": 8000
  },
  {
    "label": "ad-key-2", 
    "accessLicense": "your-access-license-2",
    "secret": "your-secret-2",
    "customerId": "your-customer-id-2", 
    "qps": 0.5,
    "daily": 8000
  }
]'
```

#### 오픈API (문서수 조회)
```bash
# JSON 형식으로 여러 키 설정 가능
NAVER_OPENAPI_KEYS='[
  {
    "label": "open-key-1",
    "clientId": "your-client-id-1",
    "clientSecret": "your-client-secret-1",
    "qps": 3,
    "daily": 20000
  },
  {
    "label": "open-key-2",
    "clientId": "your-client-id-2", 
    "clientSecret": "your-client-secret-2",
    "qps": 3,
    "daily": 20000
  }
]'
```

### 3. 서버 보안 설정
```bash
# 관리자 API 접근용 토큰
SERVER_TOKEN=your-secure-server-token-here
```

### 4. 데이터베이스 설정 (선택사항)
```bash
# 데이터베이스 연결 풀 설정
DATABASE_POOL_SIZE=10
DATABASE_TIMEOUT=30000
```

## 🚀 Vercel 환경변수 설정 방법

### 1. Vercel 대시보드 접속
1. [Vercel Dashboard](https://vercel.com/dashboard)에 로그인
2. 프로젝트 선택 (`gold-keyword`)
3. Settings → Environment Variables

### 2. 환경변수 추가
각 환경변수를 다음 순서로 추가:

1. **Supabase 설정**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **네이버 API 키**
   - `NAVER_SEARCHAD_KEYS` (JSON 문자열)
   - `NAVER_OPENAPI_KEYS` (JSON 문자열)

3. **보안 설정**
   - `SERVER_TOKEN`

### 3. 환경별 설정
- **Production**: 모든 환경변수 설정
- **Preview**: 테스트용 API 키 사용 권장
- **Development**: 로컬 개발용 설정

## 🔧 Supabase 프로젝트 설정

### 1. 새 프로젝트 생성
1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. "New Project" 클릭
3. 프로젝트 정보 입력:
   - **Name**: `naver-keyword-collector`
   - **Database Password**: 강력한 비밀번호 설정
   - **Region**: `Northeast Asia (Seoul)` 선택

### 2. API 키 확인
1. Settings → API
2. 다음 키들을 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

### 3. 데이터베이스 스키마 적용
```sql
-- scripts/schema.sql 파일의 내용을 SQL Editor에서 실행
```

## 🔑 네이버 API 키 발급 방법

### 1. 검색광고 API (RelKwdStat)
1. [네이버 검색광고](https://searchad.naver.com/) 접속
2. 광고주 계정으로 로그인
3. 도구 → API 연동 → API 키 발급
4. 필요한 정보:
   - **Access License**
   - **Secret Key**
   - **Customer ID**

### 2. 오픈API (문서수 조회)
1. [네이버 개발자센터](https://developers.naver.com/) 접속
2. 애플리케이션 등록
3. 검색 API 선택
4. 필요한 정보:
   - **Client ID**
   - **Client Secret**

## ⚙️ 로컬 개발 환경 설정

### 1. .env.local 파일 생성
```bash
# 프로젝트 루트에 .env.local 파일 생성
cp env.example .env.local
```

### 2. 환경변수 값 입력
```bash
# .env.local 파일 편집
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NAVER_SEARCHAD_KEYS='[{"label":"test","accessLicense":"...","secret":"...","customerId":"...","qps":0.5,"daily":1000}]'
NAVER_OPENAPI_KEYS='[{"label":"test","clientId":"...","clientSecret":"...","qps":1,"daily":1000}]'
SERVER_TOKEN=test-token-123
```

### 3. 로컬 서버 실행
```bash
npm run dev
```

## 🔍 환경변수 검증

### 1. 헬스 체크 API 테스트
```bash
# 배포 후 다음 URL로 접속하여 확인
https://your-app.vercel.app/api/admin/health
```

### 2. 환경변수 확인
헬스 체크 응답에서 다음을 확인:
- ✅ Supabase 연결 상태
- ✅ API 키 상태 (active/cooling/disabled)
- ✅ 데이터베이스 통계

## 🚨 보안 주의사항

### 1. API 키 보안
- **절대 공개 저장소에 커밋하지 마세요**
- **프로덕션과 개발용 키를 분리하세요**
- **정기적으로 키를 로테이션하세요**

### 2. 서버 토큰
- **강력한 랜덤 토큰을 사용하세요**
- **토큰을 안전하게 보관하세요**
- **정기적으로 토큰을 변경하세요**

### 3. 환경변수 관리
- **민감한 정보는 Vercel Secrets 사용**
- **환경별로 다른 키 사용**
- **접근 권한을 최소화**

## 📞 문제 해결

### 1. 일반적인 오류
- **401 Unauthorized**: API 키 확인
- **403 Forbidden**: 권한 설정 확인
- **429 Too Many Requests**: QPS 제한 확인
- **500 Internal Server Error**: 환경변수 설정 확인

### 2. 디버깅 방법
1. Vercel Function 로그 확인
2. 브라우저 개발자 도구 Network 탭
3. Supabase Dashboard 로그 확인
4. 네이버 API 사용량 대시보드 확인

### 3. 지원 채널
- **GitHub Issues**: 버그 리포트
- **Vercel Support**: 배포 관련 문제
- **Supabase Support**: 데이터베이스 관련 문제
- **네이버 개발자센터**: API 관련 문제
