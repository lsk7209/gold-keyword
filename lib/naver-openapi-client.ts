// 네이버 오픈API 클라이언트 (블로그/카페/웹/뉴스 검색)

import { ApiKeyManager } from './api-key-manager'
import { rateLimitConfig } from './config'

export type SearchType = 'blog' | 'cafearticle' | 'webkr' | 'news'

export interface OpenApiSearchRequest {
  query: string
  display?: number
  start?: number
  sort?: 'sim' | 'date'
}

export interface OpenApiSearchResponse {
  total: number
  start: number
  display: number
  items?: any[]
}

export interface DocCountResult {
  keyword: string
  blog_total: number
  cafe_total: number
  web_total: number
  news_total: number
  raw: {
    blog: OpenApiSearchResponse
    cafe: OpenApiSearchResponse
    web: OpenApiSearchResponse
    news: OpenApiSearchResponse
  }
}

export class NaverOpenApiClient {
  private static readonly BASE_URL = 'https://openapi.naver.com'
  private static readonly ENDPOINTS = {
    blog: '/v1/search/blog.json',
    cafearticle: '/v1/search/cafearticle.json',
    webkr: '/v1/search/webkr.json',
    news: '/v1/search/news.json'
  }
  
  private apiKeyManager: ApiKeyManager

  constructor() {
    this.apiKeyManager = ApiKeyManager.getInstance()
  }

  // API 요청 헤더 생성
  private generateHeaders(clientId: string, clientSecret: string): Record<string, string> {
    return {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
      'Content-Type': 'application/json'
    }
  }

  // 단일 검색 타입 조회
  private async searchSingle(
    searchType: SearchType,
    query: string,
    maxRetries: number = 3
  ): Promise<OpenApiSearchResponse> {
    let lastError: any = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // API 키 선택
        const apiKey = await this.apiKeyManager.selectApiKey('openapi')
        if (!apiKey) {
          throw new Error('사용 가능한 오픈API 키가 없습니다.')
        }

        // 요청 준비
        const endpoint = NaverOpenApiClient.ENDPOINTS[searchType]
        const headers = this.generateHeaders(apiKey.key_id, apiKey.key_secret)
        
        const params = new URLSearchParams({
          query: query,
          display: '1',  // total만 필요하므로 최소값
          start: '1'
        })

        const url = `${NaverOpenApiClient.BASE_URL}${endpoint}?${params.toString()}`

        // API 호출
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(15000) // 15초 타임아웃
        })

        // API 키 사용 기록
        await this.apiKeyManager.useApiKey(apiKey.id)

        // 응답 처리
        if (!response.ok) {
          const errorData = await response.text()
          const error = {
            status: response.status,
            message: errorData,
            attempt
          }

          // 429 에러 처리
          if (response.status === 429) {
            await this.apiKeyManager.handleApiKeyError(apiKey.id, error, 'openapi')
            
            // 지수 백오프 + 지터
            const delay = this.calculateBackoffDelay(attempt, rateLimitConfig.retry.baseDelay)
            await this.sleep(delay)
            lastError = error
            continue
          }

          // 401/403 에러 처리
          if (response.status === 401 || response.status === 403) {
            await this.apiKeyManager.handleApiKeyError(apiKey.id, error, 'openapi')
            throw new Error(`인증 오류: ${response.status} - ${errorData}`)
          }

          throw new Error(`API 호출 실패: ${response.status} - ${errorData}`)
        }

        // 응답 파싱
        const responseData: OpenApiSearchResponse = await response.json()
        
        if (typeof responseData.total !== 'number') {
          console.warn(`${searchType} 응답에 total이 없습니다:`, responseData)
          return { total: 0, start: 1, display: 1 }
        }

        return responseData

      } catch (error: any) {
        lastError = error
        
        // 네트워크 에러나 타임아웃의 경우 재시도
        if (error.name === 'AbortError' || error.code === 'ECONNRESET') {
          if (attempt < maxRetries) {
            const delay = this.calculateBackoffDelay(attempt, rateLimitConfig.retry.baseDelay)
            console.warn(`네트워크 에러로 재시도 (${attempt}/${maxRetries}): ${delay}ms 후`)
            await this.sleep(delay)
            continue
          }
        }

        // 마지막 시도에서 실패한 경우
        if (attempt === maxRetries) {
          console.error(`${searchType} 검색 최종 실패: ${query}`, error)
          throw error
        }

        // 지수 백오프 + 지터
        const delay = this.calculateBackoffDelay(attempt, rateLimitConfig.retry.baseDelay)
        await this.sleep(delay)
      }
    }

    throw lastError || new Error('알 수 없는 오류가 발생했습니다.')
  }

  // 키워드의 모든 문서수 조회
  public async getDocCounts(
    keyword: string,
    maxRetries: number = 3
  ): Promise<DocCountResult> {
    const searchTypes: SearchType[] = ['blog', 'cafearticle', 'webkr', 'news']
    const results: Record<string, OpenApiSearchResponse> = {}
    
    // 병렬 처리로 성능 최적화
    const promises = searchTypes.map(async (searchType) => {
      try {
        const result = await this.searchSingle(searchType, keyword, maxRetries)
        return { searchType, result }
      } catch (error) {
        console.error(`${searchType} 검색 실패: ${keyword}`, error)
        // 개별 실패는 기본값으로 처리
        return { 
          searchType, 
          result: { total: 0, start: 1, display: 1 } 
        }
      }
    })

    const responses = await Promise.all(promises)
    
    // 결과 정리
    responses.forEach(({ searchType, result }) => {
      results[searchType] = result
    })

    return {
      keyword,
      blog_total: results.blog?.total || 0,
      cafe_total: results.cafearticle?.total || 0,
      web_total: results.webkr?.total || 0,
      news_total: results.news?.total || 0,
      raw: {
        blog: results.blog || { total: 0, start: 1, display: 1 },
        cafe: results.cafearticle || { total: 0, start: 1, display: 1 },
        web: results.webkr || { total: 0, start: 1, display: 1 },
        news: results.news || { total: 0, start: 1, display: 1 }
      }
    }
  }

  // 배치 처리 (여러 키워드의 문서수 조회)
  public async getDocCountsBatch(
    keywords: string[],
    delayBetweenKeywords: number = 200,
    maxConcurrency: number = 5
  ): Promise<DocCountResult[]> {
    const results: DocCountResult[] = []
    
    // 동시성 제어를 위한 세마포어
    const semaphore = new Array(maxConcurrency).fill(null)
    let keywordIndex = 0

    const processKeyword = async (): Promise<void> => {
      while (keywordIndex < keywords.length) {
        const currentIndex = keywordIndex++
        const keyword = keywords[currentIndex]
        
        try {
          const result = await this.getDocCounts(keyword)
          results[currentIndex] = result
          
          // 키워드 간 지연 (API 부하 분산)
          if (currentIndex < keywords.length - 1) {
            await this.sleep(delayBetweenKeywords)
          }
        } catch (error) {
          console.error(`키워드 ${keyword} 문서수 수집 실패:`, error)
          // 실패한 경우 기본값으로 처리
          results[currentIndex] = {
            keyword,
            blog_total: 0,
            cafe_total: 0,
            web_total: 0,
            news_total: 0,
            raw: {
              blog: { total: 0, start: 1, display: 1 },
              cafe: { total: 0, start: 1, display: 1 },
              web: { total: 0, start: 1, display: 1 },
              news: { total: 0, start: 1, display: 1 }
            }
          }
        }
      }
    }

    // 동시 처리
    await Promise.all(semaphore.map(() => processKeyword()))
    
    return results
  }

  // 지수 백오프 + 지터 계산
  private calculateBackoffDelay(attempt: number, baseDelay: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
    const maxDelay = rateLimitConfig.retry.maxDelay
    
    let delay = Math.min(exponentialDelay, maxDelay)
    
    // 지터 적용 (±25%)
    if (rateLimitConfig.retry.jitter) {
      const jitter = delay * 0.25 * (Math.random() - 0.5)
      delay += jitter
    }
    
    return Math.max(100, Math.floor(delay)) // 최소 100ms
  }

  // 슬립 함수
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // API 상태 확인
  public async checkApiHealth(): Promise<{
    available: boolean
    keys: number
    activeKeys: number
    coolingKeys: number
    dailyQuotaUsed: number
    dailyQuotaTotal: number
  }> {
    try {
      const status = await this.apiKeyManager.getApiKeyStatus()
      const openapiKeys = status.openapi
      
      const totalUsed = openapiKeys.reduce((sum, key) => sum + key.used_today, 0)
      const totalQuota = openapiKeys.reduce((sum, key) => sum + key.daily_quota, 0)
      
      return {
        available: openapiKeys.some(key => key.canUse),
        keys: openapiKeys.length,
        activeKeys: openapiKeys.filter(key => key.status === 'active').length,
        coolingKeys: openapiKeys.filter(key => key.status === 'cooling').length,
        dailyQuotaUsed: totalUsed,
        dailyQuotaTotal: totalQuota
      }
    } catch (error) {
      console.error('API 상태 확인 실패:', error)
      return {
        available: false,
        keys: 0,
        activeKeys: 0,
        coolingKeys: 0,
        dailyQuotaUsed: 0,
        dailyQuotaTotal: 0
      }
    }
  }

  // 일일 쿼터 사용률 확인
  public async checkDailyQuotaUsage(): Promise<{
    usageRatio: number
    isNearLimit: boolean
    remainingQuota: number
  }> {
    try {
      const health = await this.checkApiHealth()
      const usageRatio = health.dailyQuotaTotal > 0 
        ? health.dailyQuotaUsed / health.dailyQuotaTotal 
        : 0
      
      const isNearLimit = usageRatio >= 0.8 // 80% 이상 사용 시 경고
      const remainingQuota = health.dailyQuotaTotal - health.dailyQuotaUsed
      
      return {
        usageRatio,
        isNearLimit,
        remainingQuota
      }
    } catch (error) {
      console.error('일일 쿼터 사용률 확인 실패:', error)
      return {
        usageRatio: 0,
        isNearLimit: false,
        remainingQuota: 0
      }
    }
  }

  // 테스트용 단일 검색
  public async testSearch(keyword: string): Promise<{
    success: boolean
    results: DocCountResult | null
    error: string | null
  }> {
    try {
      const results = await this.getDocCounts(keyword)
      return {
        success: true,
        results,
        error: null
      }
    } catch (error: any) {
      return {
        success: false,
        results: null,
        error: error.message || '알 수 없는 오류'
      }
    }
  }
}
