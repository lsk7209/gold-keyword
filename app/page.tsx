'use client'

import { useState } from 'react'
import { Search, Play, Pause, Settings, BarChart3, Database } from 'lucide-react'

interface SeedFormData {
  term: string
  autoCollect: boolean
  targetCount: number
  depthLimit: number
}

interface SystemStats {
  totalKeywords: number
  queuedKeywords: number
  processedKeywords: number
  lastUpdate: string
}

export default function HomePage() {
  const [formData, setFormData] = useState<SeedFormData>({
    term: '',
    autoCollect: true,
    targetCount: 1000,
    depthLimit: 3
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<any>(null)
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalKeywords: 0,
    queuedKeywords: 0,
    processedKeywords: 0,
    lastUpdate: new Date().toISOString()
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      const response = await fetch('/api/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()
      
      if (response.ok) {
        setSubmitResult({ success: true, data: result })
        setFormData({ ...formData, term: '' }) // 입력 필드 초기화
        // 통계 새로고침
        await loadSystemStats()
      } else {
        setSubmitResult({ success: false, error: result.error })
      }
    } catch (error) {
      setSubmitResult({ 
        success: false, 
        error: '네트워크 오류가 발생했습니다.' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const loadSystemStats = async () => {
    try {
      const response = await fetch('/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'stats' }),
      })

      if (response.ok) {
        const stats = await response.json()
        setSystemStats({
          totalKeywords: stats.totalKeywords,
          queuedKeywords: 0, // 별도 API 필요
          processedKeywords: 0, // 별도 API 필요
          lastUpdate: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('통계 로드 실패:', error)
    }
  }

  return (
    <div className="space-y-8">
      {/* 헤더 섹션 */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">
          네이버 키워드 수집 시스템
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          시드 키워드를 입력하면 자동으로 연관키워드를 수집하고, 
          블로그/카페/웹/뉴스 문서수를 집계하여 황금키워드를 발굴합니다.
        </p>
      </div>

      {/* 시스템 상태 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">총 키워드</p>
              <p className="text-2xl font-bold">{systemStats.totalKeywords.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <Play className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-muted-foreground">대기 중</p>
              <p className="text-2xl font-bold">{systemStats.queuedKeywords.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">처리 완료</p>
              <p className="text-2xl font-bold">{systemStats.processedKeywords.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 시드 키워드 입력 폼 */}
      <div className="bg-card border rounded-lg p-8">
        <h2 className="text-2xl font-semibold mb-6 flex items-center space-x-2">
          <Search className="h-6 w-6" />
          <span>시드 키워드 등록</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="term" className="block text-sm font-medium text-foreground mb-2">
              키워드 *
            </label>
            <input
              type="text"
              id="term"
              value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: e.target.value })}
              placeholder="예: 마케팅, SEO, 블로그"
              className="w-full px-4 py-3 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="targetCount" className="block text-sm font-medium text-foreground mb-2">
                목표 수집 개수
              </label>
              <input
                type="number"
                id="targetCount"
                value={formData.targetCount}
                onChange={(e) => setFormData({ ...formData, targetCount: parseInt(e.target.value) || 1000 })}
                min="1"
                max="10000"
                className="w-full px-4 py-3 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="depthLimit" className="block text-sm font-medium text-foreground mb-2">
                깊이 제한
              </label>
              <input
                type="number"
                id="depthLimit"
                value={formData.depthLimit}
                onChange={(e) => setFormData({ ...formData, depthLimit: parseInt(e.target.value) || 3 })}
                min="1"
                max="5"
                className="w-full px-4 py-3 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="autoCollect"
              checked={formData.autoCollect}
              onChange={(e) => setFormData({ ...formData, autoCollect: e.target.checked })}
              className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
              disabled={isSubmitting}
            />
            <label htmlFor="autoCollect" className="text-sm font-medium text-foreground">
              자동 수집 활성화 (연관키워드 자동 수집 및 문서수 집계)
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !formData.term.trim()}
            className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-lg font-medium hover:bg-primary/90 focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="loading-spinner"></div>
                <span>등록 중...</span>
              </div>
            ) : (
              '키워드 등록'
            )}
          </button>
        </form>

        {/* 결과 메시지 */}
        {submitResult && (
          <div className={`mt-6 p-4 rounded-lg ${
            submitResult.success 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {submitResult.success ? (
              <div>
                <h3 className="font-medium">등록 성공!</h3>
                <p className="text-sm mt-1">
                  키워드 "{submitResult.data.term}"가 등록되었습니다.
                  {submitResult.data.autoCollect && ' 자동 수집이 시작되었습니다.'}
                </p>
                <p className="text-xs mt-2 text-green-600">
                  키워드 ID: {submitResult.data.keywordId}
                </p>
              </div>
            ) : (
              <div>
                <h3 className="font-medium">등록 실패</h3>
                <p className="text-sm mt-1">{submitResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 사용 가이드 */}
      <div className="bg-muted/50 border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>사용 가이드</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
          <div>
            <h4 className="font-medium text-foreground mb-2">1. 키워드 등록</h4>
            <p>시드 키워드를 입력하고 자동 수집을 활성화하면 연관키워드 수집이 시작됩니다.</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">2. 자동 수집</h4>
            <p>네이버 검색광고 API를 통해 연관키워드를 수집하고 문서수를 집계합니다.</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">3. 데이터 확인</h4>
            <p>데이터 메뉴에서 수집된 키워드를 정렬/필터링하여 황금키워드를 발굴하세요.</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">4. CSV 내보내기</h4>
            <p>필터링된 결과를 CSV 파일로 내보내어 추가 분석에 활용하세요.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
