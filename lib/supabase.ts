import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 타입 정의
export interface Database {
  public: {
    Tables: {
      api_keys: {
        Row: {
          id: number
          provider: 'searchad' | 'openapi'
          label: string
          key_id: string
          key_secret: string
          customer_id: string | null
          status: 'active' | 'cooling' | 'disabled'
          qps_limit: number
          daily_quota: number
          used_today: number
          window_tokens: number
          window_refill_rate: number
          cooldown_until: string | null
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          provider: 'searchad' | 'openapi'
          label: string
          key_id: string
          key_secret: string
          customer_id?: string | null
          status?: 'active' | 'cooling' | 'disabled'
          qps_limit?: number
          daily_quota?: number
          used_today?: number
          window_tokens?: number
          window_refill_rate?: number
          cooldown_until?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          provider?: 'searchad' | 'openapi'
          label?: string
          key_id?: string
          key_secret?: string
          customer_id?: string | null
          status?: 'active' | 'cooling' | 'disabled'
          qps_limit?: number
          daily_quota?: number
          used_today?: number
          window_tokens?: number
          window_refill_rate?: number
          cooldown_until?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      keywords: {
        Row: {
          id: number
          term: string
          source: 'seed' | 'related'
          parent_id: number | null
          pc: number | null
          mo: number | null
          ctr_pc: number | null
          ctr_mo: number | null
          ad_count: number | null
          comp_idx: string | null
          depth: number
          status: 'queued' | 'fetched_rel' | 'counted_docs' | 'error'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          term: string
          source?: 'seed' | 'related'
          parent_id?: number | null
          pc?: number | null
          mo?: number | null
          ctr_pc?: number | null
          ctr_mo?: number | null
          ad_count?: number | null
          comp_idx?: string | null
          depth?: number
          status?: 'queued' | 'fetched_rel' | 'counted_docs' | 'error'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          term?: string
          source?: 'seed' | 'related'
          parent_id?: number | null
          pc?: number | null
          mo?: number | null
          ctr_pc?: number | null
          ctr_mo?: number | null
          ad_count?: number | null
          comp_idx?: string | null
          depth?: number
          status?: 'queued' | 'fetched_rel' | 'counted_docs' | 'error'
          created_at?: string
          updated_at?: string
        }
      }
      doc_counts: {
        Row: {
          id: number
          keyword_id: number
          date: string
          blog_total: number
          cafe_total: number
          web_total: number
          news_total: number
          raw: any | null
          created_at: string
        }
        Insert: {
          id?: number
          keyword_id: number
          date?: string
          blog_total?: number
          cafe_total?: number
          web_total?: number
          news_total?: number
          raw?: any | null
          created_at?: string
        }
        Update: {
          id?: number
          keyword_id?: number
          date?: string
          blog_total?: number
          cafe_total?: number
          web_total?: number
          news_total?: number
          raw?: any | null
          created_at?: string
        }
      }
      jobs: {
        Row: {
          id: number
          type: 'fetch_related' | 'count_docs'
          payload: any
          status: 'pending' | 'processing' | 'completed' | 'failed'
          attempts: number
          max_attempts: number
          scheduled_at: string
          started_at: string | null
          completed_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: number
          type: 'fetch_related' | 'count_docs'
          payload: any
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          attempts?: number
          max_attempts?: number
          scheduled_at?: string
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          type?: 'fetch_related' | 'count_docs'
          payload?: any
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          attempts?: number
          max_attempts?: number
          scheduled_at?: string
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      keyword_latest_view: {
        Row: {
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
          source: 'seed' | 'related'
          created_at: string
        }
      }
    }
  }
}

// 클라이언트 사이드 Supabase 클라이언트
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 서버 사이드 Supabase 클라이언트 (서비스 역할 키 사용)
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// 서버 컴포넌트용 Supabase 클라이언트
export function createServerSupabaseClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
