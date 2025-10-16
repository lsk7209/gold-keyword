#!/bin/bash

# 네이버 키워드 수집 시스템 설정 스크립트

echo "🚀 네이버 키워드 수집 시스템 설정을 시작합니다..."

# 1. 의존성 설치
echo "📦 의존성을 설치합니다..."
npm install

# 2. 환경변수 파일 생성
echo "⚙️ 환경변수 파일을 생성합니다..."
if [ ! -f .env.local ]; then
    cp env.example .env.local
    echo "✅ .env.local 파일이 생성되었습니다."
    echo "⚠️  .env.local 파일을 편집하여 실제 API 키를 설정해주세요."
else
    echo "ℹ️  .env.local 파일이 이미 존재합니다."
fi

# 3. Supabase 설정 확인
echo "🗄️ Supabase 설정을 확인합니다..."
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "⚠️  Supabase 환경변수가 설정되지 않았습니다."
    echo "   .env.local 파일에서 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해주세요."
fi

# 4. 데이터베이스 스키마 적용
echo "📊 데이터베이스 스키마를 적용합니다..."
echo "   Supabase 대시보드에서 scripts/schema.sql 파일의 내용을 실행해주세요."

# 5. API 키 초기화
echo "🔑 API 키를 초기화합니다..."
echo "   환경변수에서 API 키를 데이터베이스로 동기화하려면 다음 명령을 실행하세요:"
echo "   npm run db:seed-keys"

# 6. 개발 서버 시작
echo "🎉 설정이 완료되었습니다!"
echo ""
echo "다음 단계:"
echo "1. .env.local 파일을 편집하여 API 키를 설정하세요"
echo "2. Supabase에서 데이터베이스 스키마를 적용하세요"
echo "3. 개발 서버를 시작하세요: npm run dev"
echo ""
echo "📚 자세한 내용은 README.md 파일을 참고하세요."
