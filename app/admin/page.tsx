'use client'

import { useState, useEffect } from 'react'
import { Activity, Key, Database, Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNumber, formatDate } from '@/lib/utils'

interface ApiKeyStatus {
  id: number
  provider: string
  label: string
  status: string
  qps_limit: number
  daily_quota: number
  used_today: number
  window_tokens: number
  cooldown_until: string | null
  last_error: string | null
  canUse: boolean
  usageRatio: number
}

interface HealthData {
  timestamp: string
  overall: {
    healthy: boolean
    status: string
    issues: string[]
    uptime: number
  }
  apiKeys: {
    searchad: ApiKeyStatus[] | null
    openapi: ApiKeyStatus[] | null
    error: string | null
  }
  rateLimiter: {
    stats: any | null
    error: string | null
  }
  queue: {
    stats: any | null
    processing: any | null
    error: string | null
  }
  apis: {
    searchad: any | null
    openapi: any | null
    searchadError: string | null
    openapiError: string | null
  }
  database: {
    stats: any | null
    error: string | null
  }
}

export default function AdminPage() {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState<{related: boolean, docs: boolean}>({related: false, docs: false})

  const loadHealthData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/health', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SERVER_TOKEN || 'demo-token'}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setHealthData(data)
      } else {
        const errorData = await response.json()
        setError(errorData.error || '헬스 데이터 로드 실패')
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHealthData()
    
    // 30초마다 자동 새로고침
    const interval = setInterval(loadHealthData, 30000)
    return () => clearInterval(interval)
  }, [])

  // 수동 수집 트리거
  const triggerCollection = async (type: 'related' | 'docs') => {
    try {
      setTriggering(prev => ({ ...prev, [type]: true }))
      
      const response = await fetch('/api/trigger/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SERVER_TOKEN || 'demo-token'}`
        },
        body: JSON.stringify({ type, batchSize: type === 'related' ? 300 : 800 })
      })

      const result = await response.json()
      
      if (response.ok) {
        alert(`${type === 'related' ? '연관키워드' : '문서수'} 수집이 시작되었습니다. (${result.processed}개 처리)`)
        // 헬스 데이터 새로고침
        await loadHealthData()
      } else {
        alert(`수집 실패: ${result.error}`)
      }
    } catch (error) {
      alert('수집 요청 중 오류가 발생했습니다.')
    } finally {
      setTriggering(prev => ({ ...prev, [type]: false }))
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Activity className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <div className="loading-spinner"></div>
          <span>헬스 데이터를 불러오는 중...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-red-600 mb-2">오류 발생</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={loadHealthData} className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>다시 시도</span>
        </Button>
      </div>
    )
  }

  if (!healthData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">헬스 데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">시스템 모니터링</h1>
          <p className="text-muted-foreground mt-1">
            마지막 업데이트: {formatDate(healthData.timestamp)}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={() => triggerCollection('related')}
            disabled={triggering.related}
            className="flex items-center space-x-2"
          >
            <Play className="h-4 w-4" />
            <span>{triggering.related ? '수집 중...' : '연관키워드 수집'}</span>
          </Button>
          <Button 
            onClick={() => triggerCollection('docs')}
            disabled={triggering.docs}
            className="flex items-center space-x-2"
          >
            <Play className="h-4 w-4" />
            <span>{triggering.docs ? '수집 중...' : '문서수 수집'}</span>
          </Button>
          <Button onClick={loadHealthData} className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span>새로고침</span>
          </Button>
        </div>
      </div>

      {/* Hobby 플랜 안내 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <h3 className="font-semibold text-yellow-800">Vercel Hobby 플랜 제한</h3>
        </div>
        <p className="text-sm text-yellow-700 mb-2">
          Hobby 플랜에서는 Cron 작업이 하루에 한 번만 실행됩니다. 자동 수집은 오전 9시(연관키워드), 오후 9시(문서수)에 실행됩니다.
        </p>
        <p className="text-sm text-yellow-700">
          실시간 수집이 필요한 경우 위의 수동 수집 버튼을 사용하거나 Vercel Pro 플랜으로 업그레이드하세요.
        </p>
      </div>

      {/* 전체 상태 */}
      <div className={`border rounded-lg p-6 ${getStatusColor(healthData.overall.status)}`}>
        <div className="flex items-center space-x-3 mb-4">
          {getStatusIcon(healthData.overall.status)}
          <h2 className="text-xl font-semibold">전체 시스템 상태</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium">상태</p>
            <p className="text-lg font-bold capitalize">{healthData.overall.status}</p>
          </div>
          <div>
            <p className="text-sm font-medium">가동 시간</p>
            <p className="text-lg font-bold">{Math.floor(healthData.overall.uptime / 3600)}시간</p>
          </div>
          <div>
            <p className="text-sm font-medium">이슈 수</p>
            <p className="text-lg font-bold">{healthData.overall.issues.length}개</p>
          </div>
        </div>
        {healthData.overall.issues.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">발견된 이슈:</p>
            <ul className="list-disc list-inside space-y-1">
              {healthData.overall.issues.map((issue, index) => (
                <li key={index} className="text-sm">{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* API 키 상태 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 검색광고 API 키 */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Key className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">검색광고 API 키</h3>
          </div>
          {healthData.apiKeys.searchad ? (
            <div className="space-y-3">
              {healthData.apiKeys.searchad.map((key) => (
                <div key={key.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{key.label}</span>
                    <span className={`status-badge ${
                      key.status === 'active' ? 'status-counted_docs' :
                      key.status === 'cooling' ? 'status-fetched_rel' : 'status-error'
                    }`}>
                      {key.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">사용량</p>
                      <p>{formatNumber(key.used_today)} / {formatNumber(key.daily_quota)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">토큰</p>
                      <p>{key.window_tokens.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">QPS</p>
                      <p>{key.qps_limit}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">사용률</p>
                      <p>{(key.usageRatio * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  {key.cooldown_until && (
                    <div className="mt-2 text-sm text-yellow-600">
                      쿨다운: {formatDate(key.cooldown_until)}
                    </div>
                  )}
                  {key.last_error && (
                    <div className="mt-2 text-sm text-red-600">
                      오류: {key.last_error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">API 키 정보를 불러올 수 없습니다.</p>
          )}
        </div>

        {/* 오픈API 키 */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Key className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">오픈API 키</h3>
          </div>
          {healthData.apiKeys.openapi ? (
            <div className="space-y-3">
              {healthData.apiKeys.openapi.map((key) => (
                <div key={key.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{key.label}</span>
                    <span className={`status-badge ${
                      key.status === 'active' ? 'status-counted_docs' :
                      key.status === 'cooling' ? 'status-fetched_rel' : 'status-error'
                    }`}>
                      {key.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">사용량</p>
                      <p>{formatNumber(key.used_today)} / {formatNumber(key.daily_quota)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">토큰</p>
                      <p>{key.window_tokens.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">QPS</p>
                      <p>{key.qps_limit}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">사용률</p>
                      <p>{(key.usageRatio * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  {key.cooldown_until && (
                    <div className="mt-2 text-sm text-yellow-600">
                      쿨다운: {formatDate(key.cooldown_until)}
                    </div>
                  )}
                  {key.last_error && (
                    <div className="mt-2 text-sm text-red-600">
                      오류: {key.last_error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">API 키 정보를 불러올 수 없습니다.</p>
          )}
        </div>
      </div>

      {/* 성능 지표 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 레이트 리미터 */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Clock className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">레이트 리미터</h3>
          </div>
          {healthData.rateLimiter.stats ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">초당 요청</p>
                <p className="text-2xl font-bold">{healthData.rateLimiter.stats.requestsPerSecond}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">분당 요청</p>
                <p className="text-2xl font-bold">{healthData.rateLimiter.stats.requestsPerMinute}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">시간당 요청</p>
                <p className="text-2xl font-bold">{healthData.rateLimiter.stats.requestsPerHour}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">에러율</p>
                <p className="text-2xl font-bold text-red-600">
                  {(healthData.rateLimiter.stats.errorRate * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">활성 연결</p>
                <p className="text-2xl font-bold">{healthData.rateLimiter.stats.activeConnections}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">대기 중</p>
                <p className="text-2xl font-bold">{healthData.rateLimiter.stats.queuedRequests}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">레이트 리미터 정보를 불러올 수 없습니다.</p>
          )}
        </div>

        {/* 작업 큐 */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Database className="h-5 w-5 text-orange-600" />
            <h3 className="text-lg font-semibold">작업 큐</h3>
          </div>
          {healthData.queue.stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">대기 중</p>
                  <p className="text-2xl font-bold text-yellow-600">{healthData.queue.stats.pending}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">처리 중</p>
                  <p className="text-2xl font-bold text-blue-600">{healthData.queue.stats.processing}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">완료</p>
                  <p className="text-2xl font-bold text-green-600">{healthData.queue.stats.completed}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">실패</p>
                  <p className="text-2xl font-bold text-red-600">{healthData.queue.stats.failed}</p>
                </div>
              </div>
              
              {healthData.queue.processing && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">처리 통계</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">연관키워드 처리</p>
                      <p>{healthData.queue.processing.related?.processed || 0}개</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">문서수 처리</p>
                      <p>{healthData.queue.processing.docs?.processed || 0}개</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">작업 큐 정보를 불러올 수 없습니다.</p>
          )}
        </div>
      </div>

      {/* 데이터베이스 통계 */}
      {healthData.database.stats && (
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Database className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold">데이터베이스 통계</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium mb-3">키워드</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>총 키워드</span>
                  <span className="font-medium">{formatNumber(healthData.database.stats.keywords.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>대기 중</span>
                  <span className="font-medium">{formatNumber(healthData.database.stats.keywords.byStatus.queued || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>연관키워드 수집 완료</span>
                  <span className="font-medium">{formatNumber(healthData.database.stats.keywords.byStatus.fetched_rel || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>문서수 집계 완료</span>
                  <span className="font-medium">{formatNumber(healthData.database.stats.keywords.byStatus.counted_docs || 0)}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">문서수</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>총 문서수</span>
                  <span className="font-medium">{formatNumber(healthData.database.stats.docCounts.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>최근 24시간</span>
                  <span className="font-medium">{formatNumber(healthData.database.stats.docCounts.total)}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">작업</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>총 작업</span>
                  <span className="font-medium">{formatNumber(healthData.database.stats.jobs.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>연관키워드 수집</span>
                  <span className="font-medium">{formatNumber(healthData.database.stats.jobs.byType?.fetch_related || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>문서수 집계</span>
                  <span className="font-medium">{formatNumber(healthData.database.stats.jobs.byType?.count_docs || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
