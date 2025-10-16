# 🚀 빠른 시작 가이드

네이버 키워드 수집 시스템을 5분 안에 설정하고 실행하는 방법입니다.

## 📋 사전 준비

1. **네이버 검색광고 API 키** (RelKwdStat)
2. **네이버 오픈API 키** (블로그/카페/웹/뉴스 검색)
3. **Supabase 계정** (무료)
4. **Vercel 계정** (무료)

## ⚡ 5분 설정

### 1단계: 프로젝트 클론 (30초)
```bash
git clone https://github.com/lsk7209/gold-keyword.git
cd gold-keyword
npm install
```

### 2단계: Supabase 프로젝트 생성 (1분)
1. [Supabase](https://supabase.com) → "New Project"
2. 프로젝트명: `naver-keyword-collector`
3. 비밀번호 설정 후 "Create new project" 클릭
4. 프로젝트 생성 완료까지 대기 (약 2분)

### 3단계: 데이터베이스 설정 (1분)
1. Supabase Dashboard → SQL Editor
2. `scripts/setup-database.sql` 파일 내용을 복사하여 실행
3. "Run" 버튼 클릭하여 테이블 생성

### 4단계: 환경변수 설정 (1분)
```bash
npm run setup:env
```

`.env.local` 파일을 편집하여 다음 정보 입력:
```bash
# Supabase 설정 (Settings → API에서 복사)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 네이버 API 키 (실제 키로 교체)
NAVER_SEARCHAD_KEYS='[{"label":"key1","accessLicense":"...","secret":"...","customerId":"...","qps":0.5,"daily":8000}]'
NAVER_OPENAPI_KEYS='[{"label":"key1","clientId":"...","clientSecret":"...","qps":3,"daily":20000}]'

# 서버 토큰 (강력한 랜덤 문자열)
SERVER_TOKEN=your-secure-token-here
```

### 5단계: API 키 등록 (1분)
1. `scripts/seed-api-keys.sql` 파일을 편집하여 실제 API 키로 교체
2. Supabase SQL Editor에서 실행

### 6단계: 로컬 테스트 (30초)
```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속하여 확인

## 🚀 Vercel 배포

### 1단계: GitHub 연동
```bash
git add .
git commit -m "Initial setup complete"
git push origin main
```

### 2단계: Vercel 배포
1. [Vercel](https://vercel.com) → "Import Project"
2. GitHub 저장소 선택
3. "Deploy" 클릭

### 3단계: 환경변수 설정
1. Vercel Dashboard → Project → Settings → Environment Variables
2. `.env.local`의 모든 환경변수를 Vercel에 추가
3. "Redeploy" 클릭

## 🧪 테스트

### 로컬 테스트
```bash
npm run test:api:local
```

### 배포된 앱 테스트
```bash
npm run test:api https://your-app.vercel.app your-server-token
```

### 시스템 모니터링
```bash
npm run monitor:local
```

## 📊 사용 방법

### 1. 시드 키워드 등록
- 홈페이지에서 키워드 입력
- "자동 수집" 옵션 선택
- 등록 버튼 클릭

### 2. 수집 모니터링
- 관리자 페이지 (`/admin`)에서 진행 상황 확인
- API 키 상태, 큐 상태, 처리량 모니터링

### 3. 데이터 확인
- 데이터 페이지 (`/data`)에서 수집된 키워드 확인
- 정렬, 필터링, CSV 내보내기 기능 사용

## 🔧 문제 해결

### 빌드 실패
```bash
# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

### API 키 오류
1. Supabase에서 API 키 상태 확인
2. 네이버 API 키 유효성 검증
3. 일일 쿼터 사용량 확인

### 데이터베이스 연결 오류
1. Supabase 프로젝트 상태 확인
2. 환경변수 정확성 검증
3. RLS 정책 확인

## 📞 지원

- **GitHub Issues**: 버그 리포트 및 기능 요청
- **문서**: `README.md`, `ENVIRONMENT_SETUP.md` 참조
- **스크립트**: `scripts/` 폴더의 유틸리티 활용

## 🎯 다음 단계

1. **대량 키워드 수집**: 여러 시드 키워드로 확장
2. **성능 최적화**: API 키 추가, 동시성 조정
3. **고급 분석**: 키워드 트렌드, 경쟁 분석
4. **자동화**: 스케줄링, 알림 설정

---

**🎉 축하합니다!** 네이버 키워드 수집 시스템이 성공적으로 설정되었습니다.

이제 황금 키워드를 찾아보세요! 🏆
