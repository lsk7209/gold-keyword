// 시스템 헬스 체크 API (관리자 전용)

import { NextRequest, NextResponse } from 'next/server'
import { validateServerToken } from '@/lib/config'
import { ApiKeyManager } from '@/lib/api-key-manager'
import { RateLimiter } from '@/lib/rate-limiter'
import { QueueManager } from '@/lib/queue-manager'
import { NaverSearchAdClient } from '@/lib/naver-searchad-client'
import { NaverOpenApiClient } from '@/lib/naver-openapi-client'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // 서버 토큰 검증
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!validateServerToken(token || '')) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 모든 시스템 컴포넌트 상태 수집
    const [
      apiKeyStatus,
      rateLimitStats,
      queueStats,
      searchAdHealth,
      openApiHealth,
      dbStats
    ] = await Promise.allSettled([
      getApiKeyStatus(),
      getRateLimitStats(),
      getQueueStats(),
      getSearchAdHealth(),
      getOpenApiHealth(),
      getDatabaseStats()
    ])

    // API 키 상태
    const apiKeys = {
      searchad: apiKeyStatus.status === 'fulfilled' ? apiKeyStatus.value.searchad : null,
      openapi: apiKeyStatus.status === 'fulfilled' ? apiKeyStatus.value.openapi : null,
      error: apiKeyStatus.status === 'rejected' ? apiKeyStatus.reason?.message : null
    }

    // 레이트 리미터 상태
    const rateLimiter = {
      stats: rateLimitStats.status === 'fulfilled' ? rateLimitStats.value : null,
      error: rateLimitStats.status === 'rejected' ? rateLimitStats.reason?.message : null
    }

    // 큐 상태
    const queue = {
      stats: queueStats.status === 'fulfilled' ? queueStats.value : null,
      processing: queueStats.status === 'fulfilled' ? queueStats.value.processing : null,
      error: queueStats.status === 'rejected' ? queueStats.reason?.message : null
    }

    // API 헬스
    const apis = {
      searchad: searchAdHealth.status === 'fulfilled' ? searchAdHealth.value : null,
      openapi: openApiHealth.status === 'fulfilled' ? openApiHealth.value : null,
      searchadError: searchAdHealth.status === 'rejected' ? searchAdHealth.reason?.message : null,
      openapiError: openApiHealth.status === 'rejected' ? openApiHealth.reason?.message : null
    }

    // 데이터베이스 상태
    const database = {
      stats: dbStats.status === 'fulfilled' ? dbStats.value : null,
      error: dbStats.status === 'rejected' ? dbStats.reason?.message : null
    }

    // 전체 시스템 상태 계산
    const overallHealth = calculateOverallHealth({
      apiKeys,
      rateLimiter,
      queue,
      apis,
      database
    })

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall: overallHealth,
      apiKeys,
      rateLimiter,
      queue,
      apis,
      database
    })

  } catch (error: any) {
    console.error('헬스 체크 API 오류:', error)
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다.',
        timestamp: new Date().toISOString(),
        overall: { healthy: false, status: 'error', issues: [error.message] }
      },
      { status: 500 }
    )
  }
}

// API 키 상태 조회
async function getApiKeyStatus() {
  const apiKeyManager = ApiKeyManager.getInstance()
  return await apiKeyManager.getApiKeyStatus()
}

// 레이트 리미터 통계 조회
async function getRateLimitStats() {
  const rateLimiter = RateLimiter.getInstance()
  return rateLimiter.getRateLimitStats()
}

// 큐 통계 조회
async function getQueueStats() {
  const queueManager = QueueManager.getInstance()
  const queueStats = await queueManager.getQueueStats()
  const processingStats = queueManager.getProcessingStats()
  return { ...queueStats, processing: processingStats }
}

// 검색광고 API 헬스 체크
async function getSearchAdHealth() {
  const searchAdClient = new NaverSearchAdClient()
  return await searchAdClient.checkApiHealth()
}

// 오픈API 헬스 체크
async function getOpenApiHealth() {
  const openApiClient = new NaverOpenApiClient()
  return await openApiClient.checkApiHealth()
}

// 데이터베이스 통계 조회
async function getDatabaseStats() {
  const [
    keywordStats,
    docCountStats,
    jobStats
  ] = await Promise.all([
    supabaseAdmin
      .from('keywords')
      .select('status, source, depth')
      .not('status', 'is', null),
    supabaseAdmin
      .from('doc_counts')
      .select('date, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabaseAdmin
      .from('jobs')
      .select('status, type, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  ])

  // 키워드 통계
  const keywordBreakdown = {
    total: keywordStats.data?.length || 0,
    byStatus: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
    byDepth: {} as Record<string, number>
  }

  keywordStats.data?.forEach(keyword => {
    const status = keyword.status as string
    const source = keyword.source as string
    const depth = keyword.depth as number
    
    keywordBreakdown.byStatus[status] = (keywordBreakdown.byStatus[status] || 0) + 1
    keywordBreakdown.bySource[source] = (keywordBreakdown.bySource[source] || 0) + 1
    keywordBreakdown.byDepth[depth] = (keywordBreakdown.byDepth[depth] || 0) + 1
  })

  // 문서수 통계
  const docCountBreakdown = {
    total: docCountStats.data?.length || 0,
    byDate: {} as Record<string, number>
  }

  docCountStats.data?.forEach(docCount => {
    const date = docCount.date
    docCountBreakdown.byDate[date] = (docCountBreakdown.byDate[date] || 0) + 1
  })

  // 작업 통계
  const jobBreakdown = {
    total: jobStats.data?.length || 0,
    byStatus: {} as Record<string, number>,
    byType: {} as Record<string, number>
  }

  jobStats.data?.forEach(job => {
    jobBreakdown.byStatus[job.status] = (jobBreakdown.byStatus[job.status] || 0) + 1
    jobBreakdown.byType[job.type] = (jobBreakdown.byType[job.type] || 0) + 1
  })

  return {
    keywords: keywordBreakdown,
    docCounts: docCountBreakdown,
    jobs: jobBreakdown
  }
}

// 전체 시스템 상태 계산
function calculateOverallHealth(components: any) {
  const issues: string[] = []
  let healthy = true

  // API 키 상태 체크
  if (components.apiKeys.error) {
    issues.push(`API 키 상태 조회 실패: ${components.apiKeys.error}`)
    healthy = false
  } else {
    const searchadKeys = components.apiKeys.searchad
    const openapiKeys = components.apiKeys.openapi

    if (searchadKeys && !searchadKeys.some((key: any) => key.canUse)) {
      issues.push('사용 가능한 검색광고 API 키가 없습니다.')
      healthy = false
    }

    if (openapiKeys && !openapiKeys.some((key: any) => key.canUse)) {
      issues.push('사용 가능한 오픈API 키가 없습니다.')
      healthy = false
    }

    // 쿨다운 상태 체크
    const coolingKeys = [...(searchadKeys || []), ...(openapiKeys || [])]
      .filter((key: any) => key.status === 'cooling')
    
    if (coolingKeys.length > 0) {
      issues.push(`${coolingKeys.length}개 API 키가 쿨다운 상태입니다.`)
    }
  }

  // 레이트 리미터 상태 체크
  if (components.rateLimiter.error) {
    issues.push(`레이트 리미터 상태 조회 실패: ${components.rateLimiter.error}`)
  } else if (components.rateLimiter.stats) {
    const stats = components.rateLimiter.stats
    
    if (stats.errorRate > 0.05) {
      issues.push(`높은 에러율: ${(stats.errorRate * 100).toFixed(1)}%`)
    }

    if (stats.queuedRequests > 100) {
      issues.push(`큰 대기열: ${stats.queuedRequests}개 요청 대기 중`)
    }
  }

  // 큐 상태 체크
  if (components.queue.error) {
    issues.push(`큐 상태 조회 실패: ${components.queue.error}`)
  } else if (components.queue.stats) {
    const stats = components.queue.stats
    
    if (stats.failed > stats.completed * 0.1) {
      issues.push(`높은 작업 실패율: ${stats.failed}/${stats.completed + stats.failed}`)
    }
  }

  // 데이터베이스 상태 체크
  if (components.database.error) {
    issues.push(`데이터베이스 상태 조회 실패: ${components.database.error}`)
    healthy = false
  }

  return {
    healthy,
    status: healthy ? 'healthy' : (issues.length > 0 ? 'degraded' : 'unknown'),
    issues,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }
}
