'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, Download, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNumber, formatDate, getCompetitionColor, getCompetitionClass, debounce, generateCSVDownloadUrl, downloadCSV } from '@/lib/utils'

interface Keyword {
  id: number
  keyword: string
  sv_total: number
  cafe_total: number
  blog_total: number
  web_total: number
  news_total: number
  pc: number
  mo: number
  comp_idx: string | null
  ctr_pc: number | null
  ctr_mo: number | null
  ad_count: number
  saved_at: string | null
  depth: number
  source: string
  created_at: string
}

interface Filters {
  search: string
  hideLowSv: boolean
  hideZeroDocs: boolean
  sort: string
  svMin: string
  svMax: string
  blogMin: string
  blogMax: string
  cafeMin: string
  cafeMax: string
  webMin: string
  webMax: string
  newsMin: string
  newsMax: string
}

interface Pagination {
  hasNextPage: boolean
  nextCursor: string | null
  pageSize: number
  total: number
}

const SORT_OPTIONS = [
  { value: 'cafe_total:asc,sv_total:desc', label: '카페문서수 ↑ + 총검색수 ↓' },
  { value: 'blog_total:desc,sv_total:desc', label: '블로그문서수 ↓ + 총검색수 ↓' },
  { value: 'web_total:desc,sv_total:desc', label: '웹문서수 ↓ + 총검색수 ↓' },
  { value: 'news_total:desc,sv_total:desc', label: '뉴스문서수 ↓ + 총검색수 ↓' },
  { value: 'sv_total:desc', label: '총검색수 ↓' },
  { value: 'sv_total:asc', label: '총검색수 ↑' },
  { value: 'cafe_total:desc', label: '카페문서수 ↓' },
  { value: 'blog_total:desc', label: '블로그문서수 ↓' }
]

export default function DataPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    hasNextPage: false,
    nextCursor: null,
    pageSize: 50,
    total: 0
  })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    search: '',
    hideLowSv: true,
    hideZeroDocs: true,
    sort: 'cafe_total:asc,sv_total:desc',
    svMin: '',
    svMax: '',
    blogMin: '',
    blogMax: '',
    cafeMin: '',
    cafeMax: '',
    webMin: '',
    webMax: '',
    newsMin: '',
    newsMax: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  const [exporting, setExporting] = useState(false)

  // 키워드 데이터 로드
  const loadKeywords = useCallback(async (cursor: string | null = null, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const params = new URLSearchParams({
        pageSize: pagination.pageSize.toString(),
        hideLowSv: filters.hideLowSv.toString(),
        hideZeroDocs: filters.hideZeroDocs.toString(),
        sort: filters.sort
      })

      if (filters.search) params.append('q', filters.search)
      if (filters.svMin) params.append('svMin', filters.svMin)
      if (filters.svMax) params.append('svMax', filters.svMax)
      if (filters.blogMin) params.append('blogMin', filters.blogMin)
      if (filters.blogMax) params.append('blogMax', filters.blogMax)
      if (filters.cafeMin) params.append('cafeMin', filters.cafeMin)
      if (filters.cafeMax) params.append('cafeMax', filters.cafeMax)
      if (filters.webMin) params.append('webMin', filters.webMin)
      if (filters.webMax) params.append('webMax', filters.webMax)
      if (filters.newsMin) params.append('newsMin', filters.newsMin)
      if (filters.newsMax) params.append('newsMax', filters.newsMax)
      if (cursor) params.append('cursor', cursor)

      const response = await fetch(`/api/keywords?${params.toString()}`)
      const data = await response.json()

      if (response.ok) {
        if (reset) {
          setKeywords(data.keywords)
        } else {
          setKeywords(prev => [...prev, ...data.keywords])
        }
        setPagination(data.pagination)
      } else {
        console.error('키워드 로드 실패:', data.error)
      }
    } catch (error) {
      console.error('키워드 로드 오류:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filters, pagination.pageSize])

  // 필터 변경 시 데이터 새로고침
  const debouncedLoadKeywords = useCallback(
    debounce((cursor: string | null = null, reset: boolean = true) => {
      loadKeywords(cursor, reset)
    }, 500),
    [loadKeywords]
  )

  // 초기 데이터 로드
  useEffect(() => {
    loadKeywords(null, true)
  }, [])

  // 필터 변경 시 데이터 새로고침
  useEffect(() => {
    debouncedLoadKeywords(null, true)
  }, [filters, debouncedLoadKeywords])

  // 더 보기
  const handleLoadMore = () => {
    if (pagination.hasNextPage && pagination.nextCursor) {
      loadKeywords(pagination.nextCursor, false)
    }
  }

  // 필터 업데이트
  const updateFilter = (key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // 필터 초기화
  const resetFilters = () => {
    setFilters({
      search: '',
      hideLowSv: true,
      hideZeroDocs: true,
      sort: 'cafe_total:asc,sv_total:desc',
      svMin: '',
      svMax: '',
      blogMin: '',
      blogMax: '',
      cafeMin: '',
      cafeMax: '',
      webMin: '',
      webMax: '',
      newsMin: '',
      newsMax: ''
    })
  }

  // CSV 내보내기
  const handleExportCSV = async () => {
    try {
      setExporting(true)
      
      const params: any = {
        hideLowSv: filters.hideLowSv.toString(),
        hideZeroDocs: filters.hideZeroDocs.toString(),
        sort: filters.sort
      }

      if (filters.search) params.q = filters.search
      if (filters.svMin) params.svMin = filters.svMin
      if (filters.svMax) params.svMax = filters.svMax
      if (filters.blogMin) params.blogMin = filters.blogMin
      if (filters.blogMax) params.blogMax = filters.blogMax
      if (filters.cafeMin) params.cafeMin = filters.cafeMin
      if (filters.cafeMax) params.cafeMax = filters.cafeMax
      if (filters.webMin) params.webMin = filters.webMin
      if (filters.webMax) params.webMax = filters.webMax
      if (filters.newsMin) params.newsMin = filters.newsMin
      if (filters.newsMax) params.newsMax = filters.newsMax

      const url = generateCSVDownloadUrl('/api/export/csv', params)
      const filename = `keywords_${new Date().toISOString().split('T')[0]}.csv`
      
      downloadCSV(url, filename)
    } catch (error) {
      console.error('CSV 내보내기 실패:', error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">키워드 데이터</h1>
          <p className="text-muted-foreground mt-1">
            총 {pagination.total.toLocaleString()}개 키워드
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2"
          >
            <Filter className="h-4 w-4" />
            <span>필터</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>{exporting ? '내보내는 중...' : 'CSV 내보내기'}</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => loadKeywords(null, true)}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </Button>
        </div>
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="bg-card border rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">필터 설정</h3>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              초기화
            </Button>
          </div>

          {/* 검색 및 기본 필터 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">검색어</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="키워드 검색..."
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">정렬</label>
              <select
                value={filters.sort}
                onChange={(e) => updateFilter('sort', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.hideLowSv}
                  onChange={(e) => updateFilter('hideLowSv', e.target.checked)}
                  className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                />
                <span className="text-sm">낮은 검색수 숨기기</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.hideZeroDocs}
                  onChange={(e) => updateFilter('hideZeroDocs', e.target.checked)}
                  className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                />
                <span className="text-sm">문서수 0 숨기기</span>
              </label>
            </div>
          </div>

          {/* 범위 필터 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">총 검색수</label>
              <div className="space-y-2">
                <input
                  type="number"
                  value={filters.svMin}
                  onChange={(e) => updateFilter('svMin', e.target.value)}
                  placeholder="최소"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
                <input
                  type="number"
                  value={filters.svMax}
                  onChange={(e) => updateFilter('svMax', e.target.value)}
                  placeholder="최대"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">카페문서수</label>
              <div className="space-y-2">
                <input
                  type="number"
                  value={filters.cafeMin}
                  onChange={(e) => updateFilter('cafeMin', e.target.value)}
                  placeholder="최소"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
                <input
                  type="number"
                  value={filters.cafeMax}
                  onChange={(e) => updateFilter('cafeMax', e.target.value)}
                  placeholder="최대"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">블로그문서수</label>
              <div className="space-y-2">
                <input
                  type="number"
                  value={filters.blogMin}
                  onChange={(e) => updateFilter('blogMin', e.target.value)}
                  placeholder="최소"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
                <input
                  type="number"
                  value={filters.blogMax}
                  onChange={(e) => updateFilter('blogMax', e.target.value)}
                  placeholder="최대"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">웹문서수</label>
              <div className="space-y-2">
                <input
                  type="number"
                  value={filters.webMin}
                  onChange={(e) => updateFilter('webMin', e.target.value)}
                  placeholder="최소"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
                <input
                  type="number"
                  value={filters.webMax}
                  onChange={(e) => updateFilter('webMax', e.target.value)}
                  placeholder="최대"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">뉴스문서수</label>
              <div className="space-y-2">
                <input
                  type="number"
                  value={filters.newsMin}
                  onChange={(e) => updateFilter('newsMin', e.target.value)}
                  placeholder="최소"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
                <input
                  type="number"
                  value={filters.newsMax}
                  onChange={(e) => updateFilter('newsMax', e.target.value)}
                  placeholder="최대"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 데이터 테이블 */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <div className="loading-spinner"></div>
              <span>데이터를 불러오는 중...</span>
            </div>
          </div>
        ) : keywords.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-muted-foreground">표시할 키워드가 없습니다.</p>
              <p className="text-sm text-muted-foreground mt-1">
                필터를 조정하거나 새 키워드를 등록해보세요.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="keyword-table w-full">
                <thead>
                  <tr>
                    <th>키워드</th>
                    <th>총 검색수</th>
                    <th>카페문서수</th>
                    <th>블로그문서수</th>
                    <th>웹문서수</th>
                    <th>뉴스문서수</th>
                    <th>PC 검색수</th>
                    <th>모바일 검색수</th>
                    <th>경쟁도</th>
                    <th>PC CTR</th>
                    <th>모바일 CTR</th>
                    <th>광고수</th>
                    <th>저장일</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((keyword) => (
                    <tr key={keyword.id}>
                      <td>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{keyword.keyword}</span>
                          {keyword.source === 'seed' && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              시드
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="font-medium">{formatNumber(keyword.sv_total)}</td>
                      <td>{formatNumber(keyword.cafe_total)}</td>
                      <td>{formatNumber(keyword.blog_total)}</td>
                      <td>{formatNumber(keyword.web_total)}</td>
                      <td>{formatNumber(keyword.news_total)}</td>
                      <td>{formatNumber(keyword.pc)}</td>
                      <td>{formatNumber(keyword.mo)}</td>
                      <td>
                        {keyword.comp_idx && (
                          <span className={`status-badge ${getCompetitionClass(keyword.comp_idx)}`}>
                            {keyword.comp_idx}
                          </span>
                        )}
                      </td>
                      <td>{keyword.ctr_pc ? (keyword.ctr_pc * 100).toFixed(1) + '%' : '-'}</td>
                      <td>{keyword.ctr_mo ? (keyword.ctr_mo * 100).toFixed(1) + '%' : '-'}</td>
                      <td>{keyword.ad_count}</td>
                      <td className="text-sm text-muted-foreground">
                        {keyword.saved_at ? formatDate(keyword.saved_at) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 더 보기 버튼 */}
            {pagination.hasNextPage && (
              <div className="border-t p-4 text-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center space-x-2"
                >
                  {loadingMore ? (
                    <>
                      <div className="loading-spinner"></div>
                      <span>로딩 중...</span>
                    </>
                  ) : (
                    <>
                      <span>더 보기</span>
                      <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
