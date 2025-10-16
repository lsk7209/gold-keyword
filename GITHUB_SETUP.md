# GitHub 저장소 설정 가이드

## 1. GitHub에서 새 저장소 생성

1. [GitHub](https://github.com)에 로그인
2. 우측 상단의 "+" 버튼 클릭 → "New repository" 선택
3. 저장소 정보 입력:
   - **Repository name**: `naver-keyword-collector`
   - **Description**: `네이버 키워드 수집 시스템 - 시드 키워드 → 연관키워드 대량 수집 → 섹션별 문서수 집계 → 정렬/필터로 황금키워드 발굴`
   - **Visibility**: Public 또는 Private 선택
   - **Initialize**: 체크하지 않음 (이미 로컬에 코드가 있음)
4. "Create repository" 클릭

## 2. 로컬 저장소와 연결

GitHub에서 저장소를 생성한 후, 제공되는 명령어를 사용하여 연결:

```bash
# 원격 저장소 추가 (YOUR_USERNAME을 실제 GitHub 사용자명으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/naver-keyword-collector.git

# 기본 브랜치를 main으로 설정
git branch -M main

# GitHub에 푸시
git push -u origin main
```

## 3. 저장소 설정 완료 후

### README 업데이트
- GitHub에서 README.md 파일이 자동으로 표시됩니다
- 프로젝트 설명, 설치 방법, 사용법이 포함되어 있습니다

### Issues 및 Discussions 활성화
- Settings → Features에서 Issues와 Discussions 활성화
- 버그 리포트 및 기능 요청을 받을 수 있습니다

### GitHub Pages 설정 (선택사항)
- Settings → Pages에서 GitHub Pages 활성화
- 정적 문서 사이트를 호스팅할 수 있습니다

## 4. 협업 설정

### Collaborators 추가
- Settings → Manage access → Invite a collaborator
- 팀원들을 초대하여 협업 가능

### Branch Protection Rules
- Settings → Branches에서 main 브랜치 보호 규칙 설정
- Pull Request 리뷰 필수 설정

## 5. CI/CD 설정 (선택사항)

### GitHub Actions
- `.github/workflows/` 디렉토리에 워크플로우 파일 생성
- 자동 테스트, 빌드, 배포 설정

### Vercel 연동
- Vercel에서 GitHub 저장소 연결
- 자동 배포 설정

## 6. 보안 설정

### Secrets 설정
- Settings → Secrets and variables → Actions
- API 키, 데이터베이스 연결 정보 등 민감한 정보 저장

### Dependabot 활성화
- Settings → Security → Dependabot alerts
- 보안 취약점 자동 감지

## 7. 프로젝트 관리

### Projects 설정
- Projects 탭에서 칸반 보드 생성
- 이슈 및 PR 관리

### Milestones 설정
- Issues → Milestones에서 마일스톤 생성
- 프로젝트 진행 상황 추적

## 8. 문서화

### Wiki 활성화
- Settings → Features에서 Wiki 활성화
- 상세한 문서 작성

### Code of Conduct 추가
- 커뮤니티 가이드라인 설정

## 다음 단계

1. GitHub 저장소 생성
2. 위의 명령어로 로컬 저장소 연결
3. Vercel에서 GitHub 연동하여 자동 배포 설정
4. 환경변수 설정 및 배포 완료
