-- 네이버 키워드 수집 시스템 데이터베이스 스키마
-- PostgreSQL 14+ 호환

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 다중 API 키 풀 관리 테이블
CREATE TABLE api_keys (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('searchad', 'openapi')),
  label TEXT NOT NULL,
  key_id TEXT NOT NULL,                    -- openapi: client_id / searchad: access license
  key_secret TEXT NOT NULL,                -- openapi: client_secret / searchad: secret
  customer_id TEXT,                        -- searchad 전용
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cooling', 'disabled')),
  qps_limit NUMERIC DEFAULT 1,            -- 초당 요청 제한
  daily_quota INTEGER DEFAULT 10000,      -- 일일 쿼터
  used_today INTEGER NOT NULL DEFAULT 0,  -- 오늘 사용량
  window_tokens NUMERIC NOT NULL DEFAULT 0, -- 토큰버킷 토큰 수
  window_refill_rate NUMERIC NOT NULL DEFAULT 0, -- 토큰 리필 속도
  cooldown_until TIMESTAMPTZ,             -- 쿨다운 종료 시간
  last_error TEXT,                         -- 마지막 에러 메시지
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API 키 인덱스
CREATE INDEX idx_api_keys_status ON api_keys(status, cooldown_until);
CREATE INDEX idx_api_keys_provider ON api_keys(provider, status);
CREATE UNIQUE INDEX uniq_api_keys_label ON api_keys(provider, label);

-- 키워드 테이블 (연관/지표) - 월 파티셔닝 권장
CREATE TABLE keywords (
  id BIGSERIAL PRIMARY KEY,
  term TEXT NOT NULL,                      -- 정규화(lower/trim) 대상
  source TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'related')),
  parent_id BIGINT REFERENCES keywords(id) ON DELETE SET NULL,
  pc INTEGER,                              -- monthlyPcQcCnt
  mo INTEGER,                              -- monthlyMobileQcCnt
  ctr_pc NUMERIC,                          -- monthlyAvePcCtr
  ctr_mo NUMERIC,                          -- monthlyAveMobileCtr
  ad_count INTEGER,                        -- plAvgDepth
  comp_idx TEXT,                           -- compIdx(낮음/중간/높음)
  depth INTEGER NOT NULL DEFAULT 0,       -- 0=시드
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'fetched_rel', 'counted_docs', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 키워드 인덱스
CREATE UNIQUE INDEX uniq_keywords_term ON keywords (LOWER(TRIM(term)));
CREATE INDEX idx_keywords_status ON keywords(status);
CREATE INDEX idx_keywords_source ON keywords(source);
CREATE INDEX idx_keywords_parent ON keywords(parent_id);
CREATE INDEX idx_keywords_depth ON keywords(depth);
CREATE INDEX idx_keywords_created ON keywords(created_at);

-- 문서수 스냅샷 테이블 (일 파티셔닝 권장)
CREATE TABLE doc_counts (
  id BIGSERIAL PRIMARY KEY,
  keyword_id BIGINT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  blog_total INTEGER DEFAULT 0,
  cafe_total INTEGER DEFAULT 0,
  web_total INTEGER DEFAULT 0,
  news_total INTEGER DEFAULT 0,
  raw JSONB,                               -- 원본 API 응답 저장
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 문서수 인덱스
CREATE UNIQUE INDEX uniq_doc_counts_daily ON doc_counts(keyword_id, date);
CREATE INDEX idx_doc_counts_date ON doc_counts(date);
CREATE INDEX idx_doc_counts_keyword ON doc_counts(keyword_id);

-- 작업 큐 테이블 (내부 잡 큐)
CREATE TABLE jobs (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('fetch_related', 'count_docs')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 작업 큐 인덱스
CREATE INDEX idx_jobs_status ON jobs(status, scheduled_at);
CREATE INDEX idx_jobs_type ON jobs(type, status);

-- 조회 최적화 뷰 (테이블 컬럼 순서와 동일)
CREATE OR REPLACE VIEW keyword_latest_view AS
SELECT
  k.id,
  k.term AS keyword,
  COALESCE(k.pc, 0) + COALESCE(k.mo, 0) AS sv_total,
  COALESCE(dc.cafe_total, 0) AS cafe_total,
  COALESCE(dc.blog_total, 0) AS blog_total,
  COALESCE(dc.web_total, 0) AS web_total,
  COALESCE(dc.news_total, 0) AS news_total,
  COALESCE(k.pc, 0) AS pc,
  COALESCE(k.mo, 0) AS mo,
  k.comp_idx,
  k.ctr_pc,
  k.ctr_mo,
  COALESCE(k.ad_count, 0) AS ad_count,
  dc.date AS saved_at,
  k.depth,
  k.source,
  k.created_at
FROM keywords k
LEFT JOIN LATERAL (
  SELECT d.* FROM doc_counts d
  WHERE d.keyword_id = k.id
  ORDER BY d.date DESC
  LIMIT 1
) dc ON true;

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 설정
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keywords_updated_at BEFORE UPDATE ON keywords
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 설정
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- 공개 조회 정책 (읽기 전용)
CREATE POLICY "Public read access" ON keywords FOR SELECT USING (true);
CREATE POLICY "Public read access" ON doc_counts FOR SELECT USING (true);

-- 관리자 정책 (서비스 역할 키 필요)
CREATE POLICY "Service role full access" ON api_keys FOR ALL USING (true);
CREATE POLICY "Service role full access" ON keywords FOR ALL USING (true);
CREATE POLICY "Service role full access" ON doc_counts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON jobs FOR ALL USING (true);

-- 파티셔닝을 위한 함수 (월별 파티션 생성)
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name TEXT, start_date DATE)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  end_date DATE;
BEGIN
  partition_name := table_name || '_' || TO_CHAR(start_date, 'YYYY_MM');
  end_date := start_date + INTERVAL '1 month';
  
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
    partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- 파티셔닝을 위한 함수 (일별 파티션 생성)
CREATE OR REPLACE FUNCTION create_daily_partition(table_name TEXT, start_date DATE)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  end_date DATE;
BEGIN
  partition_name := table_name || '_' || TO_CHAR(start_date, 'YYYY_MM_DD');
  end_date := start_date + INTERVAL '1 day';
  
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
    partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- 성능 최적화를 위한 추가 인덱스
CREATE INDEX idx_keyword_latest_view_sv_total ON keywords((COALESCE(pc, 0) + COALESCE(mo, 0)));
CREATE INDEX idx_keyword_latest_view_cafe_total ON doc_counts(cafe_total);
CREATE INDEX idx_keyword_latest_view_blog_total ON doc_counts(blog_total);
CREATE INDEX idx_keyword_latest_view_web_total ON doc_counts(web_total);
CREATE INDEX idx_keyword_latest_view_news_total ON doc_counts(news_total);

-- 복합 인덱스 (정렬 최적화)
CREATE INDEX idx_keyword_sort_cafe_sv ON keywords((COALESCE(pc, 0) + COALESCE(mo, 0)) DESC, id) 
  WHERE status = 'counted_docs';

-- 통계 정보 업데이트
ANALYZE api_keys;
ANALYZE keywords;
ANALYZE doc_counts;
ANALYZE jobs;
