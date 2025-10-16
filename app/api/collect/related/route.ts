// 연관키워드 수집 API (Cron/워커 전용)

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
    const batchSize = parseInt(searchParams.get('batch') || '300')

    if (batchSize < 1 || batchSize > 1000) {
      return NextResponse.json(
        { error: '배치 크기는 1-1000 사이여야 합니다.' },
        { status: 400 }
      )
    }

    // API 키 상태 확인
    const apiKeyManager = ApiKeyManager.getInstance()
    const searchAdHealth = await apiKeyManager.getApiKeyStatus()
    
    if (!searchAdHealth.searchad.some(key => key.canUse)) {
      return NextResponse.json(
        { error: '사용 가능한 검색광고 API 키가 없습니다.' },
        { status: 503 }
      )
    }

    // 처리할 키워드 조회 (queued 상태, 시드 키워드 우선)
    const { data: keywords, error: selectError } = await supabaseAdmin
      .from('keywords')
      .select('id, term, source, depth')
      .eq('status', 'queued')
      .order('source', { ascending: true }) // seed 우선
      .order('created_at', { ascending: true })
      .limit(batchSize) as any

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
    const jobIds = await queueManager.enqueueRelatedKeywords(keywords.map((k: any) => k.id))

    // 처리 결과 로깅
    const seedCount = keywords.filter((k: any) => k.source === 'seed').length
    const relatedCount = keywords.filter((k: any) => k.source === 'related').length

    console.log(`연관키워드 수집 작업 큐에 추가: ${keywords.length}개 (시드: ${seedCount}, 연관: ${relatedCount})`)

    return NextResponse.json({
      success: true,
      message: '연관키워드 수집 작업이 큐에 추가되었습니다.',
      processed: keywords.length,
      jobIds,
      breakdown: {
        seed: seedCount,
        related: relatedCount
      }
    })

  } catch (error: any) {
    console.error('연관키워드 수집 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 연관키워드 수집 상태 조회
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

    // 키워드 상태별 통계
    const { data: keywordStats, error: statsError } = await supabaseAdmin
      .from('keywords')
      .select('status, source')
      .not('status', 'is', null)

    if (statsError) {
      console.error('키워드 통계 조회 실패:', statsError)
    }

    const statusBreakdown = {
      queued: 0,
      fetched_rel: 0,
      counted_docs: 0,
      error: 0
    }

    const sourceBreakdown = {
      seed: 0,
      related: 0
    }

    keywordStats?.forEach(keyword => {
      statusBreakdown[keyword.status as keyof typeof statusBreakdown]++
      sourceBreakdown[keyword.source as keyof typeof sourceBreakdown]++
    })

    return NextResponse.json({
      queue: queueStats,
      processing: processingStats,
      keywords: {
        status: statusBreakdown,
        source: sourceBreakdown
      }
    })

  } catch (error: any) {
    console.error('연관키워드 수집 상태 조회 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
