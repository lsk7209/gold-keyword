// 키워드 데이터 조회 API

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { dbConfig } from '@/lib/config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // 페이지네이션 파라미터
    const pageSize = Math.min(
      parseInt(searchParams.get('pageSize') || dbConfig.pagination.defaultPageSize.toString()),
      dbConfig.pagination.maxPageSize
    )
    const cursor = searchParams.get('cursor')
    
    // 필터링 파라미터
    const hideLowSv = searchParams.get('hideLowSv') !== 'false' // 기본값 true
    const hideZeroDocs = searchParams.get('hideZeroDocs') !== 'false' // 기본값 true
    const q = searchParams.get('q') // 검색어
    
    // 정렬 파라미터
    const sort = searchParams.get('sort') || 'cafe_total:asc,sv_total:desc'
    const multiSort = searchParams.get('multiSort')
    
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

    // 기본 쿼리 구성
    let query = supabaseAdmin
      .from('keyword_latest_view')
      .select('*', { count: 'exact' })

    // 검색어 필터
    if (q && q.trim()) {
      query = query.ilike('keyword', `%${q.trim()}%`)
    }

    // 기본 제외 규칙 적용
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
    const sortClauses = (multiSort || sort).split(',').map(clause => {
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

    // 커서 페이지네이션
    if (cursor) {
      try {
        const cursorData = JSON.parse(cursor)
        if (cursorData.id) {
          query = query.gt('id', cursorData.id)
        }
      } catch (error) {
        console.warn('잘못된 커서 형식:', cursor)
      }
    }

    // 페이지 크기 제한
    query = query.limit(pageSize + 1) // 다음 페이지 존재 여부 확인용

    // 쿼리 실행
    const { data: keywords, error, count } = await query as any

    if (error) {
      console.error('키워드 조회 실패:', error)
      return NextResponse.json(
        { error: '키워드 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 다음 페이지 존재 여부 확인
    const hasNextPage = keywords && keywords.length > pageSize
    const actualKeywords = hasNextPage ? keywords.slice(0, pageSize) : (keywords || [])
    
    // 다음 커서 생성
    let nextCursor = null
    if (hasNextPage && actualKeywords.length > 0) {
      const lastKeyword = actualKeywords[actualKeywords.length - 1] as any
      nextCursor = JSON.stringify({ id: lastKeyword.id })
    }

    // 응답 데이터 포맷팅
    const formattedKeywords = actualKeywords.map((keyword: any) => ({
      id: keyword.id,
      keyword: keyword.keyword,
      sv_total: keyword.sv_total,
      cafe_total: keyword.cafe_total,
      blog_total: keyword.blog_total,
      web_total: keyword.web_total,
      news_total: keyword.news_total,
      pc: keyword.pc,
      mo: keyword.mo,
      comp_idx: keyword.comp_idx,
      ctr_pc: keyword.ctr_pc,
      ctr_mo: keyword.ctr_mo,
      ad_count: keyword.ad_count,
      saved_at: keyword.saved_at,
      depth: keyword.depth,
      source: keyword.source,
      created_at: keyword.created_at
    }))

    return NextResponse.json({
      keywords: formattedKeywords,
      pagination: {
        hasNextPage,
        nextCursor,
        pageSize,
        total: count || 0
      },
      filters: {
        hideLowSv,
        hideZeroDocs,
        search: q,
        sort: multiSort || sort,
        ranges: {
          sv: { min: svMin, max: svMax },
          blog: { min: blogMin, max: blogMax },
          cafe: { min: cafeMin, max: cafeMax },
          web: { min: webMin, max: webMax },
          news: { min: newsMin, max: newsMax }
        }
      }
    })

  } catch (error: any) {
    console.error('키워드 조회 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 키워드 통계 조회
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type } = body

    if (type === 'stats') {
      // 전체 통계 조회
      const { data: stats, error } = await supabaseAdmin
        .from('keyword_latest_view')
        .select('sv_total, cafe_total, blog_total, web_total, news_total')

      if (error) {
        throw error
      }

      const totalKeywords = stats?.length || 0
      const avgSv = stats?.reduce((sum, k) => sum + k.sv_total, 0) / totalKeywords || 0
      const avgCafe = stats?.reduce((sum, k) => sum + k.cafe_total, 0) / totalKeywords || 0
      const avgBlog = stats?.reduce((sum, k) => sum + k.blog_total, 0) / totalKeywords || 0
      const avgWeb = stats?.reduce((sum, k) => sum + k.web_total, 0) / totalKeywords || 0
      const avgNews = stats?.reduce((sum, k) => sum + k.news_total, 0) / totalKeywords || 0

      return NextResponse.json({
        totalKeywords,
        averages: {
          sv_total: Math.round(avgSv),
          cafe_total: Math.round(avgCafe),
          blog_total: Math.round(avgBlog),
          web_total: Math.round(avgWeb),
          news_total: Math.round(avgNews)
        }
      })
    }

    return NextResponse.json(
      { error: '지원하지 않는 요청 타입입니다.' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('키워드 통계 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
