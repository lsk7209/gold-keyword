# Vercel 환경변수 설정 가이드

## 🔧 Supabase 환경변수

다음 환경변수들을 Vercel Dashboard → Settings → Environment Variables에 추가하세요:

### 필수 Supabase 설정
```bash
NEXT_PUBLIC_SUPABASE_URL=https://lbskbodkneqkwajymrgs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxic2tib2RrbmVxa3dhanltcmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODE5NjEsImV4cCI6MjA3NjE1Nzk2MX0.BzfBCIHNKgGa2_4wdpulnxbeddwD2-5QihjWO3SJdNQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxic2tib2RrbmVxa3dhanltcmdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU4MTk2MSwiZXhwIjoyMDc2MTU3OTYxfQ.NMYuIuJEjMO7xHZtD4vbbkboV6MYcgM_WAy04bd71Gg
```

### 추가 Supabase 설정 (선택사항)
```bash
POSTGRES_URL=postgres://postgres.lbskbodkneqkwajymrgs:sXXUsUKOgqwOx1Y5@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x
POSTGRES_USER=postgres
POSTGRES_HOST=db.lbskbodkneqkwajymrgs.supabase.co
POSTGRES_PASSWORD=sXXUsUKOgqwOx1Y5
POSTGRES_DATABASE=postgres
SUPABASE_JWT_SECRET=UKvA2os/PrbGcZirI83wk7bxlJsADu12nmgWbAwUOj+gd8dzZDgx6nYmDd7e5gpl4F3oGr37ODXZkS+SDshg+Q==
```

## 🔑 네이버 API 키 설정

### 검색광고 API (RelKwdStat)
```bash
NAVER_SEARCHAD_KEYS='[
  {
    "label": "searchad-key-1",
    "accessLicense": "your-access-license-here",
    "secret": "your-secret-key-here",
    "customerId": "your-customer-id-here",
    "qps": 0.5,
    "daily": 8000
  }
]'
```

### 오픈API (문서수 조회)
```bash
NAVER_OPENAPI_KEYS='[
  {
    "label": "openapi-key-1",
    "clientId": "your-client-id-here",
    "clientSecret": "your-client-secret-here",
    "qps": 3.0,
    "daily": 20000
  }
]'
```

## 🔐 서버 보안 설정
```bash
SERVER_TOKEN=your-secure-server-token-here
```

## 📋 설정 순서

1. **Vercel Dashboard 접속**
   - https://vercel.com/dashboard
   - 프로젝트 선택 (`gold-keyword`)

2. **환경변수 추가**
   - Settings → Environment Variables
   - 위의 환경변수들을 하나씩 추가
   - **중요**: 네이버 API 키는 실제 키로 교체 필요

3. **재배포**
   - Deployments → 최신 배포 → Redeploy

## ⚠️ 주의사항

- **네이버 API 키**: 실제 발급받은 키로 교체하세요
- **SERVER_TOKEN**: 강력한 랜덤 문자열로 설정하세요
- **환경별 설정**: Production, Preview, Development 각각 설정 가능

## 🧪 테스트

환경변수 설정 후 다음 명령으로 테스트:
```bash
node scripts/test-api.js https://your-app.vercel.app your-server-token
```
