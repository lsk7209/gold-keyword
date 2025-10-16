#!/bin/bash

# 네이버 키워드 수집 시스템 배포 스크립트

echo "🚀 네이버 키워드 수집 시스템 배포를 시작합니다..."

# 1. 빌드 테스트
echo "🔨 빌드를 테스트합니다..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패. 배포를 중단합니다."
    exit 1
fi

echo "✅ 빌드 성공"

# 2. 환경변수 확인
echo "⚙️ 환경변수를 확인합니다..."
required_vars=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "SERVER_TOKEN"
    "NAVER_OPENAPI_KEYS"
    "NAVER_SEARCHAD_KEYS"
    "CRON_SECRET"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ 다음 환경변수가 설정되지 않았습니다:"
    printf '%s\n' "${missing_vars[@]}"
    echo "Vercel에서 환경변수를 설정한 후 다시 시도해주세요."
    exit 1
fi

echo "✅ 모든 환경변수가 설정되었습니다"

# 3. Git 상태 확인
echo "📝 Git 상태를 확인합니다..."
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  커밋되지 않은 변경사항이 있습니다."
    read -p "계속 진행하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "배포를 중단합니다."
        exit 1
    fi
fi

# 4. Vercel 배포
echo "🌐 Vercel에 배포합니다..."
vercel --prod

if [ $? -eq 0 ]; then
    echo "✅ 배포가 완료되었습니다!"
    echo ""
    echo "다음 단계:"
    echo "1. Vercel 대시보드에서 환경변수를 확인하세요"
    echo "2. Cron 작업이 활성화되었는지 확인하세요"
    echo "3. 헬스 체크 API를 테스트하세요"
    echo ""
    echo "🔗 Vercel 대시보드: https://vercel.com/dashboard"
else
    echo "❌ 배포 실패"
    exit 1
fi
