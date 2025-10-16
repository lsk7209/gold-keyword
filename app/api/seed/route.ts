// 시드 키워드 등록 API

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { QueueManager } from '@/lib/queue-manager'
import { validateConfig } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    // 설정 검증
    const configValidation = validateConfig()
    if (!configValidation.isValid) {
      return NextResponse.json(
        { error: '설정 오류', details: configValidation.errors },
        { status: 500 }
      )
    }

    // 요청 본문 파싱
    const body = await request.json()
    const { term, autoCollect = true, targetCount = 1000, depthLimit = 3 } = body

    // 입력 검증
    if (!term || typeof term !== 'string' || term.trim().length === 0) {
      return NextResponse.json(
        { error: '키워드가 필요합니다.' },
        { status: 400 }
      )
    }

    if (targetCount < 1 || targetCount > 10000) {
      return NextResponse.json(
        { error: '목표 수집 개수는 1-10000 사이여야 합니다.' },
        { status: 400 }
      )
    }

    if (depthLimit < 1 || depthLimit > 5) {
      return NextResponse.json(
        { error: '깊이 제한은 1-5 사이여야 합니다.' },
        { status: 400 }
      )
    }

    const normalizedTerm = term.trim().toLowerCase()

    // 중복 키워드 확인
    const { data: existingKeyword, error: checkError } = await supabaseAdmin
      .from('keywords')
      .select('id, status')
      .eq('term', normalizedTerm)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('키워드 중복 확인 실패:', checkError)
      return NextResponse.json(
        { error: '키워드 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (existingKeyword) {
      return NextResponse.json(
        { 
          error: '이미 등록된 키워드입니다.',
          keywordId: existingKeyword.id,
          status: existingKeyword.status
        },
        { status: 409 }
      )
    }

    // 시드 키워드 등록
    const { data: keyword, error: insertError } = await supabaseAdmin
      .from('keywords')
      .insert({
        term: normalizedTerm,
        source: 'seed',
        depth: 0,
        status: 'queued'
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('시드 키워드 등록 실패:', insertError)
      return NextResponse.json(
        { error: '키워드 등록에 실패했습니다.' },
        { status: 500 }
      )
    }

    const keywordId = keyword.id

    // 자동 수집이 활성화된 경우 작업 큐에 추가
    if (autoCollect) {
      try {
        const queueManager = QueueManager.getInstance()
        
        // 연관키워드 수집 작업 추가
        await queueManager.enqueueRelatedKeywords([keywordId])
        
        console.log(`시드 키워드 등록 및 수집 작업 큐에 추가: ${normalizedTerm} (ID: ${keywordId})`)
      } catch (queueError) {
        console.error('작업 큐 추가 실패:', queueError)
        // 큐 추가 실패는 키워드 등록을 롤백하지 않음
      }
    }

    // 응답
    return NextResponse.json({
      success: true,
      keywordId,
      term: normalizedTerm,
      autoCollect,
      targetCount,
      depthLimit,
      message: autoCollect 
        ? '키워드가 등록되고 수집 작업이 시작되었습니다.'
        : '키워드가 등록되었습니다.'
    })

  } catch (error: any) {
    console.error('시드 키워드 등록 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 시드 키워드 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const status = searchParams.get('status')

    const offset = (page - 1) * pageSize

    let query = supabaseAdmin
      .from('keywords')
      .select('id, term, status, depth, created_at, pc, mo')
      .eq('source', 'seed')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: keywords, error, count } = await query

    if (error) {
      console.error('시드 키워드 조회 실패:', error)
      return NextResponse.json(
        { error: '키워드 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      keywords: keywords || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    })

  } catch (error: any) {
    console.error('시드 키워드 조회 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
