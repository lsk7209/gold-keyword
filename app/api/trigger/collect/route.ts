// 수동 수집 트리거 API (Hobby 플랜 대안)

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

    const body = await request.json()
    const { type, batchSize } = body

    if (!type || !['related', 'docs'].includes(type)) {
      return NextResponse.json(
        { error: 'type은 "related" 또는 "docs"여야 합니다.' },
        { status: 400 }
      )
    }

    // API 키 상태 확인
    const apiKeyManager = ApiKeyManager.getInstance()
    const provider = type === 'related' ? 'searchad' : 'openapi'
    const health = await apiKeyManager.getApiKeyStatus()
    
    if (!health[provider].some(key => key.canUse)) {
      return NextResponse.json(
        { error: `사용 가능한 ${provider} API 키가 없습니다.` },
        { status: 503 }
      )
    }

    // 큐 매니저로 작업 처리
    const queueManager = QueueManager.getInstance()
    let result

    if (type === 'related') {
      // 연관키워드 수집
      const { data: keywords } = await supabaseAdmin
        .from('keywords')
        .select('id')
        .eq('status', 'queued')
        .limit(batchSize || 300)

      if (keywords && keywords.length > 0) {
        const jobIds = await queueManager.enqueueRelatedKeywords(
          keywords.map(k => k.id),
          Math.min(5, keywords.length)
        )
        result = {
          message: '연관키워드 수집 작업이 큐에 추가되었습니다.',
          processed: keywords.length,
          jobIds
        }
      } else {
        result = {
          message: '처리할 키워드가 없습니다.',
          processed: 0
        }
      }
    } else {
      // 문서수 수집
      const { data: keywords } = await supabaseAdmin
        .from('keywords')
        .select('id')
        .eq('status', 'fetched_rel')
        .limit(batchSize || 800)

      if (keywords && keywords.length > 0) {
        const jobIds = await queueManager.enqueueDocCounts(
          keywords.map(k => k.id),
          Math.min(10, keywords.length)
        )
        result = {
          message: '문서수 수집 작업이 큐에 추가되었습니다.',
          processed: keywords.length,
          jobIds
        }
      } else {
        result = {
          message: '처리할 키워드가 없습니다.',
          processed: 0
        }
      }
    }

    return NextResponse.json({
      success: true,
      type,
      ...result
    })

  } catch (error: any) {
    console.error('수동 수집 트리거 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 수집 상태 조회
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

    const queueManager = QueueManager.getInstance()
    const queueStats = await queueManager.getQueueStats()
    const processingStats = queueManager.getProcessingStats()

    return NextResponse.json({
      queue: queueStats,
      processing: processingStats,
      lastUpdate: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('수집 상태 조회 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
