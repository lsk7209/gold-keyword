import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '네이버 키워드 수집 시스템',
  description: '시드 키워드 → 연관키워드 대량 수집 → 섹션별 문서수 집계 → 정렬/필터로 황금키워드 발굴',
  keywords: ['네이버', '키워드', '수집', '마케팅', 'SEO'],
  authors: [{ name: 'Naver Keyword Collector' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <header className="border-b bg-card">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h1 className="text-2xl font-bold text-primary">
                    네이버 키워드 수집 시스템
                  </h1>
                  <span className="text-sm text-muted-foreground">
                    시드 키워드 → 연관키워드 → 문서수 집계 → 황금키워드 발굴
                  </span>
                </div>
                <nav className="flex items-center space-x-6">
                  <a 
                    href="/" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    홈
                  </a>
                  <a 
                    href="/data" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    데이터
                  </a>
                  <a 
                    href="/insights" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    인사이트
                  </a>
                  <a 
                    href="/admin" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    관리
                  </a>
                </nav>
              </div>
            </div>
          </header>
          
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
          
          <footer className="border-t bg-card mt-auto">
            <div className="container mx-auto px-4 py-6">
              <div className="text-center text-sm text-muted-foreground">
                <p>© 2024 네이버 키워드 수집 시스템. 모든 권리 보유.</p>
                <p className="mt-2">
                  Next.js 14 + Supabase + Vercel Functions + 네이버 API
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
