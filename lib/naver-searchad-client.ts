// 네이버 검색광고 API 클라이언트 (RelKwdStat)

import crypto from 'crypto'
import { ApiKeyManager } from './api-key-manager'
import { rateLimitConfig } from './config'

export interface RelKwdStatRequest {
  hintKeywords: string[]  // 최대 5개
  showDetail?: boolean
}

export interface RelKwdStatResponse {
  keywordList: RelKwdStatItem[]
}

export interface RelKwdStatItem {
  relKeyword: string           // 연관키워드
  monthlyPcQcCnt: number       // PC 월간 검색수
  monthlyMobileQcCnt: number   // 모바일 월간 검색수
  monthlyAvePcCtr: number      // PC 평균 CTR
  monthlyAveMobileCtr: number  // 모바일 평균 CTR
  plAvgDepth: number           // 광고수
  compIdx: string              // 경쟁도 (낮음/중간/높음)
}

export interface NormalizedKeywordData {
  term: string
  pc: number
  mo: number
  ctr_pc: number
  ctr_mo: number
  ad_count: number
  comp_idx: string
}

export class NaverSearchAdClient {
  private static readonly BASE_URL = 'https://api.naver.com'
  private static readonly ENDPOINT = '/keywordstool'
  private apiKeyManager: ApiKeyManager

  constructor() {
    this.apiKeyManager = ApiKeyManager.getInstance()
  }

  // HMAC-SHA256 서명 생성
  private generateSignature(
    secret: string,
    timestamp: string,
    method: string,
    uri: string
  ): string {
    const message = `${timestamp}.${method}.${uri}`
    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64')
  }

  // API 요청 헤더 생성
  private generateHeaders(
    accessLicense: string,
    customerId: string,
    secret: string,
    method: string = 'GET',
    uri: string = NaverSearchAdClient.ENDPOINT
  ): Record<string, string> {
    const timestamp = Date.now().toString()
    const signature = this.generateSignature(secret, timestamp, method, uri)

    return {
      'X-Timestamp': timestamp,
      'X-API-KEY': accessLicense,
      'X-Customer': customerId,
      'X-Signature': signature,
      'Content-Type': 'application/json'
    }
  }

  // 연관키워드 조회
  public async getRelatedKeywords(
    hintKeywords: string[],
    maxRetries: number = 3
  ): Promise<NormalizedKeywordData[]> {
    if (hintKeywords.length === 0 || hintKeywords.length > 5) {
      throw new Error('hintKeywords는 1-5개 사이여야 합니다.')
    }

    let lastError: any = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // API 키 선택
        const apiKey = await this.apiKeyManager.selectApiKey('searchad')
        if (!apiKey) {
          throw new Error('사용 가능한 검색광고 API 키가 없습니다.')
        }

        // 요청 준비
        const requestData: RelKwdStatRequest = {
          hintKeywords,
          showDetail: true
        }

        const headers = this.generateHeaders(
          apiKey.key_id,
          apiKey.customer_id!,
          apiKey.key_secret
        )

        const url = `${NaverSearchAdClient.BASE_URL}${NaverSearchAdClient.ENDPOINT}?hintKeywords=${encodeURIComponent(hintKeywords.join(','))}&showDetail=1`

        // API 호출
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(30000) // 30초 타임아웃
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
            await this.apiKeyManager.handleApiKeyError(apiKey.id, error, 'searchad')
            
            // 지수 백오프 + 지터
            const delay = this.calculateBackoffDelay(attempt, rateLimitConfig.retry.baseDelay)
            await this.sleep(delay)
            lastError = error
            continue
          }

          // 401/403 에러 처리
          if (response.status === 401 || response.status === 403) {
            await this.apiKeyManager.handleApiKeyError(apiKey.id, error, 'searchad')
            throw new Error(`인증 오류: ${response.status} - ${errorData}`)
          }

          throw new Error(`API 호출 실패: ${response.status} - ${errorData}`)
        }

        // 응답 파싱
        const responseData: RelKwdStatResponse = await response.json()
        
        if (!responseData.keywordList) {
          console.warn('응답에 keywordList가 없습니다:', responseData)
          return []
        }

        // 데이터 정규화
        const normalizedData = this.normalizeKeywordData(responseData.keywordList)
        
        console.log(`연관키워드 수집 성공: ${hintKeywords.join(', ')} → ${normalizedData.length}개`)
        return normalizedData

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
          console.error(`연관키워드 수집 최종 실패: ${hintKeywords.join(', ')}`, error)
          throw error
        }

        // 지수 백오프 + 지터
        const delay = this.calculateBackoffDelay(attempt, rateLimitConfig.retry.baseDelay)
        await this.sleep(delay)
      }
    }

    throw lastError || new Error('알 수 없는 오류가 발생했습니다.')
  }

  // 데이터 정규화
  private normalizeKeywordData(keywordList: RelKwdStatItem[]): NormalizedKeywordData[] {
    return keywordList.map(item => {
      // 검색수 정규화 (< 10 → 10)
      const pc = Math.max(10, item.monthlyPcQcCnt || 0)
      const mo = Math.max(10, item.monthlyMobileQcCnt || 0)

      // CTR 정규화 (백분율)
      const ctr_pc = this.normalizeNumber(item.monthlyAvePcCtr)
      const ctr_mo = this.normalizeNumber(item.monthlyAveMobileCtr)

      // 광고수 정규화
      const ad_count = Math.max(0, item.plAvgDepth || 0)

      // 경쟁도 정규화
      const comp_idx = this.normalizeCompIdx(item.compIdx)

      return {
        term: item.relKeyword.trim(),
        pc,
        mo,
        ctr_pc,
        ctr_mo,
        ad_count,
        comp_idx
      }
    })
  }

  // 숫자 정규화 (null/undefined → 0)
  private normalizeNumber(value: any): number {
    if (value === null || value === undefined || isNaN(value)) {
      return 0
    }
    return Number(value)
  }

  // 경쟁도 정규화
  private normalizeCompIdx(compIdx: string): string {
    if (!compIdx) return '낮음'
    
    const normalized = compIdx.trim()
    if (['낮음', '중간', '높음'].includes(normalized)) {
      return normalized
    }
    
    // 숫자로 된 경우 변환
    const num = Number(normalized)
    if (num <= 30) return '낮음'
    if (num <= 70) return '중간'
    return '높음'
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

  // 배치 처리 (여러 키워드 그룹을 순차 처리)
  public async getRelatedKeywordsBatch(
    keywordGroups: string[][],
    delayBetweenGroups: number = 1000
  ): Promise<NormalizedKeywordData[]> {
    const results: NormalizedKeywordData[] = []
    
    for (let i = 0; i < keywordGroups.length; i++) {
      const group = keywordGroups[i]
      
      try {
        const groupResults = await this.getRelatedKeywords(group)
        results.push(...groupResults)
        
        // 그룹 간 지연 (API 부하 분산)
        if (i < keywordGroups.length - 1) {
          await this.sleep(delayBetweenGroups)
        }
      } catch (error) {
        console.error(`키워드 그룹 ${i + 1} 처리 실패:`, group, error)
        // 개별 그룹 실패는 전체를 중단하지 않음
      }
    }
    
    return results
  }

  // API 상태 확인
  public async checkApiHealth(): Promise<{
    available: boolean
    keys: number
    activeKeys: number
    coolingKeys: number
  }> {
    try {
      const status = await this.apiKeyManager.getApiKeyStatus()
      const searchadKeys = status.searchad
      
      return {
        available: searchadKeys.some(key => key.canUse),
        keys: searchadKeys.length,
        activeKeys: searchadKeys.filter(key => key.status === 'active').length,
        coolingKeys: searchadKeys.filter(key => key.status === 'cooling').length
      }
    } catch (error) {
      console.error('API 상태 확인 실패:', error)
      return {
        available: false,
        keys: 0,
        activeKeys: 0,
        coolingKeys: 0
      }
    }
  }
}
