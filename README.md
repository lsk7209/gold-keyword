# 네이버 키워드 수집 시스템

시드 키워드 → 연관키워드 대량 수집 → 섹션별 문서수 집계 → 정렬/필터로 황금키워드 발굴을 완전 자동화하는 시스템입니다.

## 🚀 주요 기능

- **자동 키워드 수집**: 시드 키워드로부터 연관키워드 자동 수집
- **다중 API 키 관리**: 네이버 검색광고 API와 오픈API의 다중 키 풀링
- **레이트 리미팅**: 토큰버킷, 전역 세마포어, 429 쿨다운 관리
- **실시간 문서수 집계**: 블로그/카페/웹/뉴스 문서수 자동 수집
- **고성능 데이터 테이블**: 서버사이드 페이지네이션, 정렬, 필터링
- **CSV 내보내기**: 한글 헤더 유지 및 UTF-8 인코딩

## 🏗️ 기술 스택

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Backend**: Vercel Functions, Vercel Cron
- **Database**: Supabase (PostgreSQL 14+)
- **Styling**: Tailwind CSS, Radix UI
- **External APIs**: 네이버 검색광고 API, 네이버 오픈API

## 📋 사전 요구사항

1. **네이버 검색광고 API 키** (RelKwdStat)
2. **네이버 오픈API 키** (블로그/카페/웹/뉴스 검색)
3. **Supabase 프로젝트**
4. **Vercel 계정** (배포용)

## ⚙️ 설치 및 설정

### 1. 프로젝트 클론 및 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`env.example` 파일을 참고하여 환경변수를 설정하세요:

```bash
cp env.example .env.local
```

필수 환경변수:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 익명 키
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase 서비스 역할 키
- `NAVER_OPENAPI_KEYS`: 네이버 오픈API 키 JSON 배열
- `NAVER_SEARCHAD_KEYS`: 네이버 검색광고 API 키 JSON 배열
- `SERVER_TOKEN`: API 보안용 서버 토큰

### 3. 데이터베이스 설정

Supabase에서 다음 SQL을 실행하여 테이블을 생성하세요:

```sql
-- scripts/schema.sql 파일의 내용을 실행
```

### 4. 개발 서버 실행

```bash
npm run dev
```

## 📊 데이터베이스 스키마

### 주요 테이블

- `api_keys`: 다중 API 키 관리
- `keywords`: 키워드 및 검색 지표 저장
- `doc_counts`: 일별 문서수 스냅샷
- `keyword_latest_view`: 조회 최적화 뷰

### 파티셔닝

- `keywords`: 월별 파티셔닝 권장
- `doc_counts`: 일별 파티셔닝 권장

## 🔄 수집 파이프라인

1. **시드 등록**: 홈에서 시드 키워드 입력
2. **연관키워드 수집**: RelKwdStat API로 연관키워드 수집
3. **문서수 집계**: 오픈API로 블로그/카페/웹/뉴스 문서수 수집
4. **데이터 표시**: 정렬/필터링된 결과를 테이블에 표시

## 🎯 성능 목표

- **429 비율**: < 5%/시간
- **평균 대기시간**: < 60초
- **처리량**: related ≥ 60/min, docs ≥ 200/min
- **데이터 품질**: 정규화 실패율 < 0.1%

## 📈 모니터링

헬스 대시보드에서 다음 지표를 모니터링할 수 있습니다:

- API 키 사용량 및 쿨다운 상태
- 큐 적재/처리량
- 429 에러율
- 일일 쿼터 사용량

## 🚀 배포

### Vercel 배포

1. GitHub에 코드 푸시
2. Vercel에서 프로젝트 연결
3. 환경변수 설정
4. 자동 배포 완료

### Cron 작업 설정

Vercel에서 다음 Cron 작업을 설정하세요:

- `collect-related`: 연관키워드 수집 (5분마다)
- `collect-docs`: 문서수 집계 (10분마다)
- `reset-daily-quota`: 일일 쿼터 리셋 (매일 자정)

## 🔧 API 엔드포인트

### 공개 API

- `POST /api/seed`: 시드 키워드 등록
- `GET /api/keywords`: 키워드 데이터 조회

### 관리자 API (서버 토큰 필요)

- `POST /api/collect/related`: 연관키워드 수집
- `POST /api/collect/docs`: 문서수 집계
- `GET /api/admin/health`: 시스템 상태 조회

## 📝 라이선스

MIT License

## 🤝 기여

이슈나 풀 리퀘스트를 환영합니다.

## 📞 지원

문제가 발생하면 GitHub Issues를 통해 문의해주세요.
