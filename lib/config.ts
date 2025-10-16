// 환경변수 및 설정 관리

export interface ApiKeyConfig {
  label: string
  clientId?: string
  clientSecret?: string
  accessLicense?: string
  secret?: string
  customerId?: string
  qps: number
  daily: number
}

export interface AppConfig {
  serverToken: string
  openApiKeys: ApiKeyConfig[]
  searchAdKeys: ApiKeyConfig[]
  cronSecret: string
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
}

// 환경변수 파싱 및 검증
function parseApiKeys(envVar: string | undefined, provider: 'openapi' | 'searchad'): ApiKeyConfig[] {
  if (!envVar) {
    console.warn(`환경변수 ${provider.toUpperCase()}_KEYS가 설정되지 않았습니다.`)
    return []
  }

  try {
    const keys = JSON.parse(envVar) as ApiKeyConfig[]
    
    // 기본값 검증 및 설정
    return keys.map(key => ({
      ...key,
      qps: key.qps || (provider === 'openapi' ? 3 : 0.5),
      daily: key.daily || (provider === 'openapi' ? 20000 : 8000)
    }))
  } catch (error) {
    console.error(`${provider.toUpperCase()}_KEYS 파싱 오류:`, error)
    return []
  }
}

// 설정 객체 생성
export const config: AppConfig = {
  serverToken: process.env.SERVER_TOKEN || '',
  openApiKeys: parseApiKeys(process.env.NAVER_OPENAPI_KEYS, 'openapi'),
  searchAdKeys: parseApiKeys(process.env.NAVER_SEARCHAD_KEYS, 'searchad'),
  cronSecret: process.env.CRON_SECRET || '',
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  }
}

// 설정 검증
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.serverToken) {
    errors.push('SERVER_TOKEN이 설정되지 않았습니다.')
  }

  if (!config.supabase.url) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.')
  }

  if (!config.supabase.anonKey) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.')
  }

  if (!config.supabase.serviceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.')
  }

  if (config.openApiKeys.length === 0) {
    errors.push('NAVER_OPENAPI_KEYS가 설정되지 않았거나 유효하지 않습니다.')
  }

  if (config.searchAdKeys.length === 0) {
    errors.push('NAVER_SEARCHAD_KEYS가 설정되지 않았거나 유효하지 않습니다.')
  }

  if (!config.cronSecret) {
    errors.push('CRON_SECRET이 설정되지 않았습니다.')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// API 키 검증
export function validateApiKey(apiKey: ApiKeyConfig, provider: 'openapi' | 'searchad'): string[] {
  const errors: string[] = []

  if (!apiKey.label) {
    errors.push('label이 필요합니다.')
  }

  if (provider === 'openapi') {
    if (!apiKey.clientId) {
      errors.push('clientId가 필요합니다.')
    }
    if (!apiKey.clientSecret) {
      errors.push('clientSecret이 필요합니다.')
    }
  } else if (provider === 'searchad') {
    if (!apiKey.accessLicense) {
      errors.push('accessLicense가 필요합니다.')
    }
    if (!apiKey.secret) {
      errors.push('secret이 필요합니다.')
    }
    if (!apiKey.customerId) {
      errors.push('customerId가 필요합니다.')
    }
  }

  if (apiKey.qps <= 0) {
    errors.push('qps는 0보다 커야 합니다.')
  }

  if (apiKey.daily <= 0) {
    errors.push('daily는 0보다 커야 합니다.')
  }

  return errors
}

// 서버 토큰 검증
export function validateServerToken(token: string): boolean {
  return token === config.serverToken
}

// 환경별 설정
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'

// 로깅 설정
export const logConfig = {
  level: isDevelopment ? 'debug' : 'info',
  enableApiLogging: isDevelopment,
  enableErrorLogging: true
}

// 레이트 리미팅 설정
export const rateLimitConfig = {
  // 전역 세마포어 설정
  globalSemaphore: {
    related: 4,    // 연관키워드 수집 동시성
    docs: 10       // 문서수 수집 동시성
  },
  
  // 토큰버킷 설정
  tokenBucket: {
    refillInterval: 1000, // 1초마다 리필
    maxTokens: 2          // 최대 토큰 수 (qps_limit * 2)
  },
  
  // 쿨다운 설정
  cooldown: {
    searchAd: 300,        // 5분
    openApi: {
      initial: 60,        // 1분
      max: 300,           // 5분
      multiplier: 2       // 지수 백오프
    }
  },
  
  // 재시도 설정
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,      // 1초
    maxDelay: 30000,      // 30초
    jitter: true          // 지터 적용
  }
}

// 데이터베이스 설정
export const dbConfig = {
  // 페이지네이션
  pagination: {
    defaultPageSize: 50,
    maxPageSize: 1000
  },
  
  // 필터링
  filtering: {
    defaultHideLowSv: true,
    defaultHideZeroDocs: true,
    minSvThreshold: 500
  },
  
  // 정렬
  sorting: {
    default: 'cafe_total:asc,sv_total:desc'
  }
}
