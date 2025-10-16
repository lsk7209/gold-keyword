// API 키 관리 및 레이트 리미팅 시스템

import { supabaseAdmin } from './supabase'
import { config, rateLimitConfig } from './config'
import { Database } from './supabase'

type ApiKey = Database['public']['Tables']['api_keys']['Row']
type ApiKeyInsert = Database['public']['Tables']['api_keys']['Insert']
type ApiKeyUpdate = Database['public']['Tables']['api_keys']['Update']

export interface ApiKeyWithTokens extends ApiKey {
  availableTokens: number
  canUse: boolean
  usageRatio: number
}

export class ApiKeyManager {
  private static instance: ApiKeyManager
  private keyCache: Map<string, ApiKeyWithTokens> = new Map()
  private lastRefill: number = Date.now()
  private semaphores: Map<string, number> = new Map()

  private constructor() {
    // 토큰 리필 타이머 (1초마다)
    setInterval(() => {
      this.refillTokens()
    }, rateLimitConfig.tokenBucket.refillInterval)
  }

  public static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager()
    }
    return ApiKeyManager.instance
  }

  // API 키 초기화 (환경변수에서 데이터베이스로 동기화)
  public async initializeApiKeys(): Promise<void> {
    try {
      // 오픈API 키 동기화
      for (const keyConfig of config.openApiKeys) {
        await this.upsertApiKey({
          provider: 'openapi',
          label: keyConfig.label,
          key_id: keyConfig.clientId!,
          key_secret: keyConfig.clientSecret!,
          qps_limit: keyConfig.qps,
          daily_quota: keyConfig.daily,
          window_refill_rate: keyConfig.qps
        })
      }

      // 검색광고 API 키 동기화
      for (const keyConfig of config.searchAdKeys) {
        await this.upsertApiKey({
          provider: 'searchad',
          label: keyConfig.label,
          key_id: keyConfig.accessLicense!,
          key_secret: keyConfig.secret!,
          customer_id: keyConfig.customerId!,
          qps_limit: keyConfig.qps,
          daily_quota: keyConfig.daily,
          window_refill_rate: keyConfig.qps
        })
      }

      console.log('API 키 초기화 완료')
    } catch (error) {
      console.error('API 키 초기화 실패:', error)
      throw error
    }
  }

  // API 키 업서트
  private async upsertApiKey(keyData: ApiKeyInsert): Promise<void> {
    const { error } = await (supabaseAdmin
      .from('api_keys')
      .upsert(keyData as any, {
        onConflict: 'provider,label'
      }) as any)

    if (error) {
      console.error('API 키 업서트 실패:', error)
      throw error
    }
  }

  // 사용 가능한 API 키 선택
  public async selectApiKey(provider: 'searchad' | 'openapi'): Promise<ApiKeyWithTokens | null> {
    try {
      // 캐시된 키가 있으면 사용
      const cachedKey = this.keyCache.get(provider)
      if (cachedKey && cachedKey.canUse) {
        return cachedKey
      }

      // 데이터베이스에서 사용 가능한 키 조회
      const { data: keys, error } = await supabaseAdmin
        .from('api_keys')
        .select('*')
        .eq('provider', provider)
        .eq('status', 'active')
        .is('cooldown_until', null) as any

      if (error) {
        console.error('API 키 조회 실패:', error)
        return null
      }

      if (!keys || keys.length === 0) {
        console.warn(`사용 가능한 ${provider} API 키가 없습니다.`)
        return null
      }

      // 토큰이 있고 일일 쿼터를 초과하지 않은 키 선택 (사용률 낮은 순, 토큰 높은 순)
      const availableKeys = keys
        .filter((key: any) => key.used_today < key.daily_quota) // 일일 쿼터 체크
        .map((key: any) => ({
          ...key,
          availableTokens: Math.min(key.window_tokens, rateLimitConfig.tokenBucket.maxTokens * key.qps_limit),
          canUse: key.window_tokens >= 1,
          usageRatio: key.used_today / key.daily_quota
        }))
        .filter((key: any) => key.canUse)
        .sort((a, b) => {
          // 사용률 낮은 순
          if (a.usageRatio !== b.usageRatio) {
            return a.usageRatio - b.usageRatio
          }
          // 토큰 높은 순
          return b.availableTokens - a.availableTokens
        })

      if (availableKeys.length === 0) {
        console.warn(`토큰이 있는 ${provider} API 키가 없습니다.`)
        return null
      }

      const selectedKey = availableKeys[0]
      
      // 캐시 업데이트
      this.keyCache.set(provider, selectedKey)

      return selectedKey
    } catch (error) {
      console.error('API 키 선택 실패:', error)
      return null
    }
  }

  // API 키 사용 (토큰 소모)
  public async useApiKey(keyId: number, tokensUsed: number = 1): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('api_keys')
        .update({
          window_tokens: supabaseAdmin.raw(`GREATEST(0, window_tokens - ${tokensUsed})`),
          used_today: supabaseAdmin.raw('used_today + 1'),
          updated_at: new Date().toISOString()
        })
        .eq('id', keyId)

      if (error) {
        console.error('API 키 사용 업데이트 실패:', error)
        throw error
      }

      // 캐시 무효화
      this.keyCache.clear()
    } catch (error) {
      console.error('API 키 사용 실패:', error)
      throw error
    }
  }

  // API 키 에러 처리 (쿨다운 설정)
  public async handleApiKeyError(
    keyId: number, 
    error: any, 
    provider: 'searchad' | 'openapi'
  ): Promise<void> {
    try {
      let cooldownSeconds = 0
      let newStatus: 'active' | 'cooling' | 'disabled' = 'active'

      if (error.status === 429) {
        // 429 에러 처리
        cooldownSeconds = provider === 'searchad' 
          ? rateLimitConfig.cooldown.searchAd 
          : rateLimitConfig.cooldown.openApi.initial
        
        newStatus = 'cooling'
      } else if (error.status === 401 || error.status === 403) {
        // 인증 에러 처리
        newStatus = 'disabled'
        cooldownSeconds = 3600 // 1시간
      }

      const cooldownUntil = cooldownSeconds > 0 
        ? new Date(Date.now() + cooldownSeconds * 1000).toISOString()
        : null

      const { error: updateError } = await supabaseAdmin
        .from('api_keys')
        .update({
          status: newStatus,
          cooldown_until: cooldownUntil,
          last_error: error.message || 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', keyId)

      if (updateError) {
        console.error('API 키 에러 처리 실패:', updateError)
        throw updateError
      }

      // 캐시 무효화
      this.keyCache.clear()

      console.warn(`API 키 ${keyId} 에러 처리: ${newStatus}, 쿨다운 ${cooldownSeconds}초`)
    } catch (error) {
      console.error('API 키 에러 처리 실패:', error)
      throw error
    }
  }

  // 토큰 리필
  private async refillTokens(): Promise<void> {
    const now = Date.now()
    const timePassed = now - this.lastRefill
    this.lastRefill = now

    try {
      // 모든 활성 키의 토큰 리필
      const { error } = await supabaseAdmin
        .from('api_keys')
        .update({
          window_tokens: supabaseAdmin.raw(`
            LEAST(
              ${rateLimitConfig.tokenBucket.maxTokens} * qps_limit,
              window_tokens + (window_refill_rate * ${timePassed / 1000})
            )
          `),
          updated_at: new Date().toISOString()
        })
        .eq('status', 'active')
        .is('cooldown_until', null)

      if (error) {
        console.error('토큰 리필 실패:', error)
      }
    } catch (error) {
      console.error('토큰 리필 실패:', error)
    }
  }

  // 일일 쿼터 리셋 (매일 자정 실행)
  public async resetDailyQuota(): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('api_keys')
        .update({
          used_today: 0,
          updated_at: new Date().toISOString()
        })
        .eq('status', 'active')

      if (error) {
        console.error('일일 쿼터 리셋 실패:', error)
        throw error
      }

      // 캐시 무효화
      this.keyCache.clear()

      console.log('일일 쿼터 리셋 완료')
    } catch (error) {
      console.error('일일 쿼터 리셋 실패:', error)
      throw error
    }
  }

  // 쿨다운 만료된 키 활성화
  public async activateExpiredKeys(): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('api_keys')
        .update({
          status: 'active',
          cooldown_until: null,
          updated_at: new Date().toISOString()
        })
        .eq('status', 'cooling')
        .lt('cooldown_until', new Date().toISOString())

      if (error) {
        console.error('쿨다운 만료 키 활성화 실패:', error)
        throw error
      }

      // 캐시 무효화
      this.keyCache.clear()
    } catch (error) {
      console.error('쿨다운 만료 키 활성화 실패:', error)
      throw error
    }
  }

  // API 키 상태 조회
  public async getApiKeyStatus(): Promise<{
    openapi: ApiKeyWithTokens[]
    searchad: ApiKeyWithTokens[]
  }> {
    try {
      const { data: keys, error } = await supabaseAdmin
        .from('api_keys')
        .select('*')
        .order('provider', { ascending: true })
        .order('label', { ascending: true })

      if (error) {
        console.error('API 키 상태 조회 실패:', error)
        throw error
      }

      const openapi = keys
        ?.filter(key => key.provider === 'openapi')
        .map(key => ({
          ...key,
          availableTokens: Math.min(key.window_tokens, rateLimitConfig.tokenBucket.maxTokens * key.qps_limit),
          canUse: key.window_tokens >= 1 && key.status === 'active',
          usageRatio: key.used_today / key.daily_quota
        })) || []

      const searchad = keys
        ?.filter(key => key.provider === 'searchad')
        .map(key => ({
          ...key,
          availableTokens: Math.min(key.window_tokens, rateLimitConfig.tokenBucket.maxTokens * key.qps_limit),
          canUse: key.window_tokens >= 1 && key.status === 'active',
          usageRatio: key.used_today / key.daily_quota
        })) || []

      return { openapi, searchad }
    } catch (error) {
      console.error('API 키 상태 조회 실패:', error)
      throw error
    }
  }

  // 전역 세마포어 관리
  public async acquireSemaphore(type: 'related' | 'docs'): Promise<boolean> {
    const maxConcurrency = rateLimitConfig.globalSemaphore[type]
    const current = this.semaphores.get(type) || 0

    if (current >= maxConcurrency) {
      return false
    }

    this.semaphores.set(type, current + 1)
    return true
  }

  public releaseSemaphore(type: 'related' | 'docs'): void {
    const current = this.semaphores.get(type) || 0
    this.semaphores.set(type, Math.max(0, current - 1))
  }
}
