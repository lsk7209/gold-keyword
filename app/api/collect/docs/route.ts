// 문서수 수집 API (Cron/워커 전용)

import { NextRequest, NextResponse } from 'next/server'
import { validateServerToken } from '@/lib/config'
import { QueueManager } from '@/lib/queue-manager'
import { ApiKeyManager } from '@/lib/api-key-manager'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
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

    // 요청 파라미터 파싱
    const { searchParams } = new URL(request.url)
    const batchSize = parseInt(searchParams.get('batch') || '800')

    if (batchSize < 1 || batchSize > 2000) {
      return NextResponse.json(
        { error: '배치 크기는 1-2000 사이여야 합니다.' },
        { status: 400 }
      )
    }

    // API 키 상태 확인
    const apiKeyManager = ApiKeyManager.getInstance()
    const openApiHealth = await apiKeyManager.getApiKeyStatus()
    
    if (!openApiHealth.openapi.some(key => key.canUse)) {
      return NextResponse.json(
        { error: '사용 가능한 오픈API 키가 없습니다.' },
        { status: 503 }
      )
    }

    // 일일 쿼터 사용률 확인
    const quotaUsage = await apiKeyManager.getApiKeyStatus()
    const totalUsed = quotaUsage.openapi.reduce((sum, key) => sum + key.used_today, 0)
    const totalQuota = quotaUsage.openapi.reduce((sum, key) => sum + key.daily_quota, 0)
    const usageRatio = totalQuota > 0 ? totalUsed / totalQuota : 0

    if (usageRatio >= 0.9) {
      return NextResponse.json(
        { 
          error: '일일 쿼터가 90% 이상 사용되었습니다.',
          usageRatio,
          used: totalUsed,
          quota: totalQuota
        },
        { status: 429 }
      )
    }

    // 처리할 키워드 조회 (fetched_rel 상태)
    const { data: keywords, error: selectError } = await supabaseAdmin
      .from('keywords')
      .select('id, term')
      .eq('status', 'fetched_rel')
      .order('created_at', { ascending: true })
      .limit(batchSize)

    if (selectError) {
      console.error('키워드 조회 실패:', selectError)
      return NextResponse.json(
        { error: '키워드 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    if (!keywords || keywords.length === 0) {
      return NextResponse.json({
        success: true,
        message: '처리할 키워드가 없습니다.',
        processed: 0
      })
    }

    // 큐 매니저로 작업 처리
    const queueManager = QueueManager.getInstance()
    const jobIds = await queueManager.enqueueDocCounts(keywords.map(k => k.id))

    console.log(`문서수 수집 작업 큐에 추가: ${keywords.length}개`)

    return NextResponse.json({
      success: true,
      message: '문서수 수집 작업이 큐에 추가되었습니다.',
      processed: keywords.length,
      jobIds,
      quota: {
        usageRatio,
        used: totalUsed,
        quota: totalQuota,
        remaining: totalQuota - totalUsed
      }
    })

  } catch (error: any) {
    console.error('문서수 수집 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 문서수 수집 상태 조회
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

    // 큐 상태 조회
    const queueManager = QueueManager.getInstance()
    const queueStats = await queueManager.getQueueStats()
    const processingStats = queueManager.getProcessingStats()

    // API 키 상태 조회
    const apiKeyManager = ApiKeyManager.getInstance()
    const apiKeyStatus = await apiKeyManager.getApiKeyStatus()

    // 일일 쿼터 사용률
    const totalUsed = apiKeyStatus.openapi.reduce((sum, key) => sum + key.used_today, 0)
    const totalQuota = apiKeyStatus.openapi.reduce((sum, key) => sum + key.daily_quota, 0)
    const usageRatio = totalQuota > 0 ? totalUsed / totalQuota : 0

    // 최근 문서수 수집 통계
    const { data: recentCounts, error: countsError } = await supabaseAdmin
      .from('doc_counts')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    const recentCount = recentCounts?.length || 0

    return NextResponse.json({
      queue: queueStats,
      processing: processingStats,
      apiKeys: {
        total: apiKeyStatus.openapi.length,
        active: apiKeyStatus.openapi.filter(key => key.status === 'active').length,
        cooling: apiKeyStatus.openapi.filter(key => key.status === 'cooling').length,
        quota: {
          usageRatio,
          used: totalUsed,
          quota: totalQuota,
          remaining: totalQuota - totalUsed
        }
      },
      recent: {
        countsCollected: recentCount,
        last24Hours: true
      }
    })

  } catch (error: any) {
    console.error('문서수 수집 상태 조회 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
