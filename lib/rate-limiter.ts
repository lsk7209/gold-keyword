// 레이트 리미팅 및 동시성 제어 시스템

import { ApiKeyManager } from './api-key-manager'
import { rateLimitConfig } from './config'

export interface RateLimitStats {
  requestsPerSecond: number
  requestsPerMinute: number
  requestsPerHour: number
  activeConnections: number
  queuedRequests: number
  errorRate: number
  lastReset: Date
}

export interface SemaphoreStats {
  related: {
    active: number
    max: number
    queued: number
  }
  docs: {
    active: number
    max: number
    queued: number
  }
}

export class RateLimiter {
  private static instance: RateLimiter
  private requestCounts: Map<string, number[]> = new Map()
  private errorCounts: Map<string, number[]> = new Map()
  private activeConnections: Map<string, number> = new Map()
  private requestQueues: Map<string, Array<() => Promise<void>>> = new Map()
  private lastReset: Date = new Date()
  private apiKeyManager: ApiKeyManager

  private constructor() {
    this.apiKeyManager = ApiKeyManager.getInstance()
    
    // 1분마다 통계 리셋
    setInterval(() => {
      this.resetStats()
    }, 60000)
  }

  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter()
    }
    return RateLimiter.instance
  }

  // 요청 허용 여부 확인
  public async canMakeRequest(
    provider: 'searchad' | 'openapi',
    operation: 'related' | 'docs'
  ): Promise<boolean> {
    try {
      // 전역 세마포어 확인
      const semaphoreAcquired = await this.apiKeyManager.acquireSemaphore(operation)
      if (!semaphoreAcquired) {
        return false
      }

      // API 키 사용 가능 여부 확인
      const apiKey = await this.apiKeyManager.selectApiKey(provider)
      if (!apiKey) {
        this.apiKeyManager.releaseSemaphore(operation)
        return false
      }

      // 토큰 사용 가능 여부 확인
      if (apiKey.window_tokens < 1) {
        this.apiKeyManager.releaseSemaphore(operation)
        return false
      }

      return true
    } catch (error) {
      console.error('요청 허용 여부 확인 실패:', error)
      return false
    }
  }

  // 요청 실행 (레이트 리미팅 적용)
  public async executeWithRateLimit<T>(
    provider: 'searchad' | 'openapi',
    operation: 'related' | 'docs',
    requestFn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    let success = false
    let error: any = null

    try {
      // 요청 허용 여부 확인
      const canProceed = await this.canMakeRequest(provider, operation)
      if (!canProceed) {
        throw new Error(`${provider} ${operation} 요청이 레이트 리미트에 의해 차단되었습니다.`)
      }

      // 요청 카운트 증가
      this.incrementRequestCount(provider, operation)

      // 요청 실행
      const result = await requestFn()
      success = true
      return result

    } catch (err) {
      error = err
      this.incrementErrorCount(provider, operation)
      throw err
    } finally {
      // 세마포어 해제
      this.apiKeyManager.releaseSemaphore(operation)
      
      // 연결 카운트 감소
      this.decrementActiveConnection(provider, operation)
      
      // 통계 기록
      this.recordRequestStats(provider, operation, success, Date.now() - startTime)
    }
  }

  // 요청 카운트 증가
  private incrementRequestCount(provider: string, operation: string): void {
    const key = `${provider}:${operation}`
    const now = Date.now()
    
    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, [])
    }
    
    const counts = this.requestCounts.get(key)!
    counts.push(now)
    
    // 1시간 이상 된 기록 제거
    const oneHourAgo = now - 3600000
    const filteredCounts = counts.filter(timestamp => timestamp > oneHourAgo)
    this.requestCounts.set(key, filteredCounts)
  }

  // 에러 카운트 증가
  private incrementErrorCount(provider: string, operation: string): void {
    const key = `${provider}:${operation}`
    const now = Date.now()
    
    if (!this.errorCounts.has(key)) {
      this.errorCounts.set(key, [])
    }
    
    const counts = this.errorCounts.get(key)!
    counts.push(now)
    
    // 1시간 이상 된 기록 제거
    const oneHourAgo = now - 3600000
    const filteredCounts = counts.filter(timestamp => timestamp > oneHourAgo)
    this.errorCounts.set(key, filteredCounts)
  }

  // 활성 연결 수 증가
  private incrementActiveConnection(provider: string, operation: string): void {
    const key = `${provider}:${operation}`
    const current = this.activeConnections.get(key) || 0
    this.activeConnections.set(key, current + 1)
  }

  // 활성 연결 수 감소
  private decrementActiveConnection(provider: string, operation: string): void {
    const key = `${provider}:${operation}`
    const current = this.activeConnections.get(key) || 0
    this.activeConnections.set(key, Math.max(0, current - 1))
  }

  // 요청 통계 기록
  private recordRequestStats(
    provider: string,
    operation: string,
    success: boolean,
    duration: number
  ): void {
    // 여기서는 간단한 로깅만 수행
    // 실제 운영에서는 메트릭 수집 시스템으로 전송
    if (!success) {
      console.warn(`${provider} ${operation} 요청 실패 (${duration}ms)`)
    }
  }

  // 통계 리셋
  private resetStats(): void {
    this.lastReset = new Date()
    // 필요시 특정 통계만 리셋
  }

  // 레이트 리미트 통계 조회
  public getRateLimitStats(): RateLimitStats {
    const now = Date.now()
    const oneSecondAgo = now - 1000
    const oneMinuteAgo = now - 60000
    const oneHourAgo = now - 3600000

    let totalRequestsPerSecond = 0
    let totalRequestsPerMinute = 0
    let totalRequestsPerHour = 0
    let totalErrorsPerHour = 0
    let totalActiveConnections = 0
    let totalQueuedRequests = 0

    // 모든 키에 대한 통계 집계
    for (const [key, timestamps] of this.requestCounts) {
      const recentRequests = timestamps.filter(ts => ts > oneSecondAgo).length
      const minuteRequests = timestamps.filter(ts => ts > oneMinuteAgo).length
      const hourRequests = timestamps.filter(ts => ts > oneHourAgo).length

      totalRequestsPerSecond += recentRequests
      totalRequestsPerMinute += minuteRequests
      totalRequestsPerHour += hourRequests

      // 활성 연결 수
      const active = this.activeConnections.get(key) || 0
      totalActiveConnections += active

      // 대기 중인 요청 수
      const queued = this.requestQueues.get(key)?.length || 0
      totalQueuedRequests += queued
    }

    // 에러율 계산
    for (const [key, timestamps] of this.errorCounts) {
      const hourErrors = timestamps.filter(ts => ts > oneHourAgo).length
      totalErrorsPerHour += hourErrors
    }

    const errorRate = totalRequestsPerHour > 0 ? totalErrorsPerHour / totalRequestsPerHour : 0

    return {
      requestsPerSecond: totalRequestsPerSecond,
      requestsPerMinute: totalRequestsPerMinute,
      requestsPerHour: totalRequestsPerHour,
      activeConnections: totalActiveConnections,
      queuedRequests: totalQueuedRequests,
      errorRate,
      lastReset: this.lastReset
    }
  }

  // 세마포어 통계 조회
  public getSemaphoreStats(): SemaphoreStats {
    return {
      related: {
        active: 0, // ApiKeyManager에서 관리
        max: rateLimitConfig.globalSemaphore.related,
        queued: 0
      },
      docs: {
        active: 0, // ApiKeyManager에서 관리
        max: rateLimitConfig.globalSemaphore.docs,
        queued: 0
      }
    }
  }

  // 대기열에 요청 추가
  public async queueRequest<T>(
    provider: 'searchad' | 'openapi',
    operation: 'related' | 'docs',
    requestFn: () => Promise<T>
  ): Promise<T> {
    const key = `${provider}:${operation}`
    
    if (!this.requestQueues.has(key)) {
      this.requestQueues.set(key, [])
    }

    return new Promise((resolve, reject) => {
      const queue = this.requestQueues.get(key)!
      
      queue.push(async () => {
        try {
          const result = await this.executeWithRateLimit(provider, operation, requestFn)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      // 큐 처리 시작 (비동기)
      this.processQueue(key).catch(console.error)
    })
  }

  // 큐 처리
  private async processQueue(key: string): Promise<void> {
    const queue = this.requestQueues.get(key)
    if (!queue || queue.length === 0) {
      return
    }

    const [provider, operation] = key.split(':') as ['searchad' | 'openapi', 'related' | 'docs']
    
    // 요청 허용 여부 확인
    const canProceed = await this.canMakeRequest(provider, operation)
    if (!canProceed) {
      // 잠시 후 재시도
      setTimeout(() => this.processQueue(key), 1000)
      return
    }

    // 큐에서 요청 가져와서 실행
    const requestFn = queue.shift()
    if (requestFn) {
      try {
        await requestFn()
      } catch (error) {
        console.error(`큐 요청 실행 실패: ${key}`, error)
      }
    }

    // 큐에 더 있는지 확인
    if (queue.length > 0) {
      setTimeout(() => this.processQueue(key), 100)
    }
  }

  // 대기열 상태 조회
  public getQueueStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    
    for (const [key, queue] of this.requestQueues) {
      stats[key] = queue.length
    }
    
    return stats
  }

  // 대기열 초기화
  public clearQueue(provider?: 'searchad' | 'openapi', operation?: 'related' | 'docs'): void {
    if (provider && operation) {
      const key = `${provider}:${operation}`
      this.requestQueues.set(key, [])
    } else {
      this.requestQueues.clear()
    }
  }

  // 전체 통계 초기화
  public resetAllStats(): void {
    this.requestCounts.clear()
    this.errorCounts.clear()
    this.activeConnections.clear()
    this.requestQueues.clear()
    this.lastReset = new Date()
  }

  // 헬스 체크
  public async healthCheck(): Promise<{
    healthy: boolean
    issues: string[]
    stats: RateLimitStats
  }> {
    const stats = this.getRateLimitStats()
    const issues: string[] = []

    // 에러율 체크 (5% 이상)
    if (stats.errorRate > 0.05) {
      issues.push(`높은 에러율: ${(stats.errorRate * 100).toFixed(1)}%`)
    }

    // 요청률 체크 (초당 10개 이상)
    if (stats.requestsPerSecond > 10) {
      issues.push(`높은 요청률: ${stats.requestsPerSecond}/초`)
    }

    // 대기열 체크 (100개 이상)
    if (stats.queuedRequests > 100) {
      issues.push(`큰 대기열: ${stats.queuedRequests}개 요청 대기 중`)
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats
    }
  }
}
