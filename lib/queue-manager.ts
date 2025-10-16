// 작업 큐 관리 시스템

import { supabaseAdmin } from './supabase'
import { Database } from './supabase'
import { RateLimiter } from './rate-limiter'
import { NaverSearchAdClient } from './naver-searchad-client'
import { NaverOpenApiClient } from './naver-openapi-client'

type Job = Database['public']['Tables']['jobs']['Row']
type JobInsert = Database['public']['Tables']['jobs']['Insert']
type JobUpdate = Database['public']['Tables']['jobs']['Update']

export interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  total: number
}

export interface ProcessingStats {
  related: {
    processed: number
    failed: number
    avgProcessingTime: number
  }
  docs: {
    processed: number
    failed: number
    avgProcessingTime: number
  }
}

export class QueueManager {
  private static instance: QueueManager
  private rateLimiter: RateLimiter
  private searchAdClient: NaverSearchAdClient
  private openApiClient: NaverOpenApiClient
  private isProcessing: boolean = false
  private processingStats: ProcessingStats = {
    related: { processed: 0, failed: 0, avgProcessingTime: 0 },
    docs: { processed: 0, failed: 0, avgProcessingTime: 0 }
  }

  private constructor() {
    this.rateLimiter = RateLimiter.getInstance()
    this.searchAdClient = new NaverSearchAdClient()
    this.openApiClient = new NaverOpenApiClient()
  }

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager()
    }
    return QueueManager.instance
  }

  // 작업 큐에 추가
  public async enqueueJob(
    type: 'fetch_related' | 'count_docs',
    payload: any,
    scheduledAt?: Date
  ): Promise<number> {
    try {
      const jobData: JobInsert = {
        type,
        payload,
        status: 'pending',
        scheduled_at: scheduledAt?.toISOString() || new Date().toISOString()
      }

      const { data, error } = await supabaseAdmin
        .from('jobs')
        .insert(jobData)
        .select('id')
        .single()

      if (error) {
        console.error('작업 큐 추가 실패:', error)
        throw error
      }

      console.log(`작업 큐에 추가됨: ${type} (ID: ${data.id})`)
      return data.id
    } catch (error) {
      console.error('작업 큐 추가 실패:', error)
      throw error
    }
  }

  // 연관키워드 수집 작업 큐에 추가
  public async enqueueRelatedKeywords(
    keywordIds: number[],
    batchSize: number = 5
  ): Promise<number[]> {
    const jobIds: number[] = []

    // 배치 단위로 작업 생성
    for (let i = 0; i < keywordIds.length; i += batchSize) {
      const batch = keywordIds.slice(i, i + batchSize)
      const jobId = await this.enqueueJob('fetch_related', { keywordIds: batch })
      jobIds.push(jobId)
    }

    return jobIds
  }

  // 문서수 수집 작업 큐에 추가
  public async enqueueDocCounts(
    keywordIds: number[],
    batchSize: number = 10
  ): Promise<number[]> {
    const jobIds: number[] = []

    // 배치 단위로 작업 생성
    for (let i = 0; i < keywordIds.length; i += batchSize) {
      const batch = keywordIds.slice(i, i + batchSize)
      const jobId = await this.enqueueJob('count_docs', { keywordIds: batch })
      jobIds.push(jobId)
    }

    return jobIds
  }

  // 큐 처리 시작
  public async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      console.log('이미 큐 처리가 진행 중입니다.')
      return
    }

    this.isProcessing = true
    console.log('큐 처리 시작')

    try {
      while (this.isProcessing) {
        await this.processNextJob()
        
        // 잠시 대기 (CPU 사용률 조절)
        await this.sleep(100)
      }
    } catch (error) {
      console.error('큐 처리 중 오류:', error)
    } finally {
      this.isProcessing = false
      console.log('큐 처리 종료')
    }
  }

  // 큐 처리 중지
  public stopProcessing(): void {
    this.isProcessing = false
    console.log('큐 처리 중지 요청됨')
  }

  // 다음 작업 처리
  private async processNextJob(): Promise<void> {
    try {
      // 처리할 작업 조회
      const { data: job, error } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // 처리할 작업이 없음
          return
        }
        throw error
      }

      if (!job) {
        return
      }

      // 작업 상태를 processing으로 변경
      await this.updateJobStatus(job.id, 'processing')

      // 작업 타입에 따른 처리
      const startTime = Date.now()
      let success = false

      try {
        if (job.type === 'fetch_related') {
          await this.processRelatedKeywordsJob(job)
        } else if (job.type === 'count_docs') {
          await this.processDocCountsJob(job)
        }

        success = true
        const processingTime = Date.now() - startTime

        // 통계 업데이트
        this.updateProcessingStats(job.type, success, processingTime)

        // 작업 완료
        await this.updateJobStatus(job.id, 'completed')

      } catch (error) {
        console.error(`작업 ${job.id} 처리 실패:`, error)
        
        // 재시도 로직
        const shouldRetry = await this.handleJobFailure(job, error)
        if (!shouldRetry) {
          await this.updateJobStatus(job.id, 'failed', error.message)
        }
      }

    } catch (error) {
      console.error('작업 처리 중 오류:', error)
    }
  }

  // 연관키워드 수집 작업 처리
  private async processRelatedKeywordsJob(job: Job): Promise<void> {
    const { keywordIds } = job.payload as { keywordIds: number[] }
    
    if (!keywordIds || !Array.isArray(keywordIds)) {
      throw new Error('잘못된 작업 페이로드: keywordIds가 필요합니다.')
    }

    // 키워드 조회
    const { data: keywords, error } = await supabaseAdmin
      .from('keywords')
      .select('id, term')
      .in('id', keywordIds)
      .eq('status', 'queued')

    if (error) {
      throw new Error(`키워드 조회 실패: ${error.message}`)
    }

    if (!keywords || keywords.length === 0) {
      console.log('처리할 키워드가 없습니다.')
      return
    }

    // 키워드 그룹 생성 (최대 5개씩)
    const keywordGroups: string[][] = []
    for (let i = 0; i < keywords.length; i += 5) {
      const group = keywords.slice(i, i + 5).map(k => k.term)
      keywordGroups.push(group)
    }

    // 연관키워드 수집
    const allRelatedKeywords = await this.rateLimiter.executeWithRateLimit(
      'searchad',
      'related',
      () => this.searchAdClient.getRelatedKeywordsBatch(keywordGroups)
    )

    // 데이터베이스에 저장
    await this.saveRelatedKeywords(keywords, allRelatedKeywords)
  }

  // 문서수 수집 작업 처리
  private async processDocCountsJob(job: Job): Promise<void> {
    const { keywordIds } = job.payload as { keywordIds: number[] }
    
    if (!keywordIds || !Array.isArray(keywordIds)) {
      throw new Error('잘못된 작업 페이로드: keywordIds가 필요합니다.')
    }

    // 키워드 조회
    const { data: keywords, error } = await supabaseAdmin
      .from('keywords')
      .select('id, term')
      .in('id', keywordIds)
      .eq('status', 'fetched_rel')

    if (error) {
      throw new Error(`키워드 조회 실패: ${error.message}`)
    }

    if (!keywords || keywords.length === 0) {
      console.log('처리할 키워드가 없습니다.')
      return
    }

    // 문서수 수집
    const docCounts = await this.rateLimiter.executeWithRateLimit(
      'openapi',
      'docs',
      () => this.openApiClient.getDocCountsBatch(keywords.map(k => k.term))
    )

    // 데이터베이스에 저장
    await this.saveDocCounts(keywords, docCounts)
  }

  // 연관키워드 저장
  private async saveRelatedKeywords(
    parentKeywords: { id: number; term: string }[],
    relatedKeywords: any[]
  ): Promise<void> {
    if (relatedKeywords.length === 0) {
      return
    }

    // 키워드 삽입
    const keywordInserts = relatedKeywords.map(related => ({
      term: related.term,
      source: 'related' as const,
      parent_id: parentKeywords[0]?.id, // 첫 번째 부모 키워드와 연결
      pc: related.pc,
      mo: related.mo,
      ctr_pc: related.ctr_pc,
      ctr_mo: related.ctr_mo,
      ad_count: related.ad_count,
      comp_idx: related.comp_idx,
      depth: 1, // 연관키워드는 깊이 1
      status: 'fetched_rel' as const
    }))

    const { error: insertError } = await supabaseAdmin
      .from('keywords')
      .upsert(keywordInserts, {
        onConflict: 'term'
      })

    if (insertError) {
      throw new Error(`연관키워드 저장 실패: ${insertError.message}`)
    }

    // 부모 키워드 상태 업데이트
    const parentIds = parentKeywords.map(k => k.id)
    const { error: updateError } = await supabaseAdmin
      .from('keywords')
      .update({ status: 'fetched_rel' })
      .in('id', parentIds)

    if (updateError) {
      console.error('부모 키워드 상태 업데이트 실패:', updateError)
    }

    console.log(`${relatedKeywords.length}개 연관키워드 저장 완료`)
  }

  // 문서수 저장
  private async saveDocCounts(
    keywords: { id: number; term: string }[],
    docCounts: any[]
  ): Promise<void> {
    if (docCounts.length === 0) {
      return
    }

    // 문서수 삽입
    const docCountInserts = docCounts.map((docCount, index) => ({
      keyword_id: keywords[index]?.id,
      date: new Date().toISOString().split('T')[0],
      blog_total: docCount.blog_total,
      cafe_total: docCount.cafe_total,
      web_total: docCount.web_total,
      news_total: docCount.news_total,
      raw: docCount.raw
    }))

    const { error: insertError } = await supabaseAdmin
      .from('doc_counts')
      .upsert(docCountInserts, {
        onConflict: 'keyword_id,date'
      })

    if (insertError) {
      throw new Error(`문서수 저장 실패: ${insertError.message}`)
    }

    // 키워드 상태 업데이트
    const keywordIds = keywords.map(k => k.id)
    const { error: updateError } = await supabaseAdmin
      .from('keywords')
      .update({ status: 'counted_docs' })
      .in('id', keywordIds)

    if (updateError) {
      console.error('키워드 상태 업데이트 실패:', updateError)
    }

    console.log(`${docCounts.length}개 키워드 문서수 저장 완료`)
  }

  // 작업 상태 업데이트
  private async updateJobStatus(
    jobId: number,
    status: 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const updateData: JobUpdate = {
      status,
      updated_at: new Date().toISOString()
    }

    if (status === 'processing') {
      updateData.started_at = new Date().toISOString()
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    } else if (status === 'failed') {
      updateData.error_message = errorMessage
      updateData.completed_at = new Date().toISOString()
    }

    const { error } = await supabaseAdmin
      .from('jobs')
      .update(updateData)
      .eq('id', jobId)

    if (error) {
      console.error('작업 상태 업데이트 실패:', error)
    }
  }

  // 작업 실패 처리
  private async handleJobFailure(job: Job, error: any): Promise<boolean> {
    const newAttempts = job.attempts + 1

    if (newAttempts >= job.max_attempts) {
      console.error(`작업 ${job.id} 최대 재시도 횟수 초과`)
      return false
    }

    // 재시도 스케줄링 (지수 백오프)
    const delay = Math.min(1000 * Math.pow(2, newAttempts - 1), 30000)
    const scheduledAt = new Date(Date.now() + delay)

    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        attempts: newAttempts,
        scheduled_at: scheduledAt.toISOString(),
        status: 'pending',
        error_message: error.message
      })
      .eq('id', job.id)

    if (updateError) {
      console.error('작업 재시도 스케줄링 실패:', updateError)
      return false
    }

    console.log(`작업 ${job.id} 재시도 스케줄링 (${delay}ms 후)`)
    return true
  }

  // 처리 통계 업데이트
  private updateProcessingStats(
    type: 'fetch_related' | 'count_docs',
    success: boolean,
    processingTime: number
  ): void {
    const stats = this.processingStats[type]
    
    if (success) {
      stats.processed++
      // 평균 처리 시간 업데이트 (이동 평균)
      stats.avgProcessingTime = (stats.avgProcessingTime * (stats.processed - 1) + processingTime) / stats.processed
    } else {
      stats.failed++
    }
  }

  // 큐 통계 조회
  public async getQueueStats(): Promise<QueueStats> {
    try {
      const { data, error } = await supabaseAdmin
        .from('jobs')
        .select('status')
        .not('status', 'is', null)

      if (error) {
        throw error
      }

      const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: data?.length || 0
      }

      data?.forEach(job => {
        stats[job.status as keyof typeof stats]++
      })

      return stats
    } catch (error) {
      console.error('큐 통계 조회 실패:', error)
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0
      }
    }
  }

  // 처리 통계 조회
  public getProcessingStats(): ProcessingStats {
    return { ...this.processingStats }
  }

  // 슬립 함수
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
