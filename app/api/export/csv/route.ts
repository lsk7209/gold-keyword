// CSV 내보내기 API

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { dbConfig } from '@/lib/config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // 필터링 파라미터 (keywords API와 동일)
    const hideLowSv = searchParams.get('hideLowSv') !== 'false'
    const hideZeroDocs = searchParams.get('hideZeroDocs') !== 'false'
    const q = searchParams.get('q')
    const sort = searchParams.get('sort') || 'cafe_total:asc,sv_total:desc'
    
    // 범위 필터 파라미터
    const svMin = searchParams.get('svMin') ? parseInt(searchParams.get('svMin')!) : undefined
    const svMax = searchParams.get('svMax') ? parseInt(searchParams.get('svMax')!) : undefined
    const blogMin = searchParams.get('blogMin') ? parseInt(searchParams.get('blogMin')!) : undefined
    const blogMax = searchParams.get('blogMax') ? parseInt(searchParams.get('blogMax')!) : undefined
    const cafeMin = searchParams.get('cafeMin') ? parseInt(searchParams.get('cafeMin')!) : undefined
    const cafeMax = searchParams.get('cafeMax') ? parseInt(searchParams.get('cafeMax')!) : undefined
    const webMin = searchParams.get('webMin') ? parseInt(searchParams.get('webMin')!) : undefined
    const webMax = searchParams.get('webMax') ? parseInt(searchParams.get('webMax')!) : undefined
    const newsMin = searchParams.get('newsMin') ? parseInt(searchParams.get('newsMin')!) : undefined
    const newsMax = searchParams.get('newsMax') ? parseInt(searchParams.get('newsMax')!) : undefined

    // 최대 10만 개 제한
    const maxLimit = 100000

    // 기본 쿼리 구성
    let query = supabaseAdmin
      .from('keyword_latest_view')
      .select('*')
      .limit(maxLimit)

    // 필터 적용 (keywords API와 동일한 로직)
    if (q && q.trim()) {
      query = query.ilike('keyword', `%${q.trim()}%`)
    }

    if (hideLowSv) {
      query = query.gte('sv_total', dbConfig.filtering.minSvThreshold)
    }

    if (hideZeroDocs) {
      query = query.or('cafe_total.gt.0,blog_total.gt.0,web_total.gt.0,news_total.gt.0')
    }

    // 범위 필터 적용
    if (svMin !== undefined) query = query.gte('sv_total', svMin)
    if (svMax !== undefined) query = query.lte('sv_total', svMax)
    if (blogMin !== undefined) query = query.gte('blog_total', blogMin)
    if (blogMax !== undefined) query = query.lte('blog_total', blogMax)
    if (cafeMin !== undefined) query = query.gte('cafe_total', cafeMin)
    if (cafeMax !== undefined) query = query.lte('cafe_total', cafeMax)
    if (webMin !== undefined) query = query.gte('web_total', webMin)
    if (webMax !== undefined) query = query.lte('web_total', webMax)
    if (newsMin !== undefined) query = query.gte('news_total', newsMin)
    if (newsMax !== undefined) query = query.lte('news_total', newsMax)

    // 정렬 적용
    const sortClauses = sort.split(',').map(clause => {
      const [column, direction] = clause.trim().split(':')
      return { column, ascending: direction === 'asc' }
    })

    sortClauses.forEach(({ column, ascending }, index) => {
      if (index === 0) {
        query = query.order(column, { ascending })
      } else {
        query = query.order(column, { ascending })
      }
    })

    // 쿼리 실행
    const { data: keywords, error } = await query

    if (error) {
      console.error('CSV 내보내기 데이터 조회 실패:', error)
      return NextResponse.json(
        { error: '데이터 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    // CSV 생성
    const csvContent = generateCSV(keywords || [])

    // 응답 헤더 설정
    const headers = new Headers()
    headers.set('Content-Type', 'text/csv; charset=utf-8')
    headers.set('Content-Disposition', `attachment; filename="keywords_${new Date().toISOString().split('T')[0]}.csv"`)
    headers.set('Cache-Control', 'no-cache')

    return new NextResponse(csvContent, {
      status: 200,
      headers
    })

  } catch (error: any) {
    console.error('CSV 내보내기 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// CSV 생성 함수
function generateCSV(keywords: any[]): string {
  // BOM 추가 (UTF-8 인코딩을 위한)
  const BOM = '\uFEFF'
  
  // 헤더 정의 (한글 헤더)
  const headers = [
    '키워드',
    '총 검색수',
    '카페문서수',
    '블로그문서수',
    '웹문서수',
    '뉴스문서수',
    'PC 검색수',
    '모바일 검색수',
    '경쟁도',
    'PC CTR',
    '모바일 CTR',
    '광고수',
    '저장일',
    '깊이',
    '소스',
    '생성일'
  ]

  // CSV 행 생성
  const rows = keywords.map(keyword => [
    escapeCSVField(keyword.keyword),
    keyword.sv_total,
    keyword.cafe_total,
    keyword.blog_total,
    keyword.web_total,
    keyword.news_total,
    keyword.pc,
    keyword.mo,
    escapeCSVField(keyword.comp_idx || ''),
    keyword.ctr_pc || 0,
    keyword.ctr_mo || 0,
    keyword.ad_count,
    escapeCSVField(keyword.saved_at || ''),
    keyword.depth,
    escapeCSVField(keyword.source),
    escapeCSVField(keyword.created_at)
  ])

  // CSV 내용 조합
  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ]

  return BOM + csvLines.join('\n')
}

// CSV 필드 이스케이프 함수
function escapeCSVField(field: any): string {
  if (field === null || field === undefined) {
    return ''
  }

  const str = String(field)
  
  // 쉼표, 따옴표, 줄바꿈이 포함된 경우 따옴표로 감싸고 내부 따옴표는 이스케이프
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  
  return str
}
