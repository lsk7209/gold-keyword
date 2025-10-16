-- 네이버 키워드 수집 시스템 데이터베이스 설정
-- Supabase SQL Editor에서 실행하세요

-- 1. 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. API 키 테이블 생성
CREATE TABLE IF NOT EXISTS api_keys (
    id BIGSERIAL PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('searchad', 'openapi')),
    label TEXT NOT NULL,
    key_id TEXT NOT NULL,
    key_secret TEXT NOT NULL,
    customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cooling', 'disabled')),
    qps_limit NUMERIC DEFAULT 1.0,
    daily_quota INTEGER DEFAULT 10000,
    used_today INTEGER NOT NULL DEFAULT 0,
    window_tokens NUMERIC NOT NULL DEFAULT 2.0,
    window_refill_rate NUMERIC NOT NULL DEFAULT 1.0,
    cooldown_until TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 키워드 테이블 생성
CREATE TABLE IF NOT EXISTS keywords (
    id BIGSERIAL PRIMARY KEY,
    term TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'related')),
    parent_id BIGINT REFERENCES keywords(id) ON DELETE SET NULL,
    pc INTEGER,
    mo INTEGER,
    ctr_pc NUMERIC,
    ctr_mo NUMERIC,
    ad_count INTEGER,
    comp_idx TEXT,
    depth INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'fetched_rel', 'counted_docs', 'error')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 문서수 테이블 생성
CREATE TABLE IF NOT EXISTS doc_counts (
    id BIGSERIAL PRIMARY KEY,
    keyword_id BIGINT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    blog_total INTEGER DEFAULT 0,
    cafe_total INTEGER DEFAULT 0,
    web_total INTEGER DEFAULT 0,
    news_total INTEGER DEFAULT 0,
    raw JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 작업 큐 테이블 생성
CREATE TABLE IF NOT EXISTS jobs (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('fetch_related', 'count_docs')),
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status, cooldown_until);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider, status);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_keywords_term ON keywords (LOWER(TRIM(term)));
CREATE INDEX IF NOT EXISTS idx_keywords_status ON keywords(status);
CREATE INDEX IF NOT EXISTS idx_keywords_source ON keywords(source);
CREATE INDEX IF NOT EXISTS idx_keywords_depth ON keywords(depth);
CREATE INDEX IF NOT EXISTS idx_keywords_created_at ON keywords(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_doc_counts_daily ON doc_counts(keyword_id, date);
CREATE INDEX IF NOT EXISTS idx_doc_counts_date ON doc_counts(date);
CREATE INDEX IF NOT EXISTS idx_doc_counts_blog ON doc_counts(blog_total);
CREATE INDEX IF NOT EXISTS idx_doc_counts_cafe ON doc_counts(cafe_total);
CREATE INDEX IF NOT EXISTS idx_doc_counts_web ON doc_counts(web_total);
CREATE INDEX IF NOT EXISTS idx_doc_counts_news ON doc_counts(news_total);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

-- 7. 최적화된 뷰 생성
CREATE OR REPLACE VIEW keyword_latest_view AS
SELECT
    k.id,
    k.term AS keyword,
    COALESCE(k.pc, 0) + COALESCE(k.mo, 0) AS sv_total,
    COALESCE(dc.cafe_total, 0) AS cafe_total,
    COALESCE(dc.blog_total, 0) AS blog_total,
    COALESCE(dc.web_total, 0) AS web_total,
    COALESCE(dc.news_total, 0) AS news_total,
    k.pc,
    k.mo,
    k.comp_idx,
    k.ctr_pc,
    k.ctr_mo,
    k.ad_count,
    k.depth,
    k.source,
    k.status,
    COALESCE(dc.date, CURRENT_DATE) AS saved_at,
    k.created_at,
    k.updated_at
FROM keywords k
LEFT JOIN LATERAL (
    SELECT d.* 
    FROM doc_counts d
    WHERE d.keyword_id = k.id
    ORDER BY d.date DESC
    LIMIT 1
) dc ON true;

-- 8. 성능 최적화를 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_keyword_latest_view_sv_cafe 
ON keywords ((COALESCE(pc, 0) + COALESCE(mo, 0)), id) 
WHERE status = 'counted_docs';

CREATE INDEX IF NOT EXISTS idx_keyword_latest_view_cafe_sv 
ON keywords (id, (COALESCE(pc, 0) + COALESCE(mo, 0))) 
WHERE status = 'counted_docs';

-- 9. RLS (Row Level Security) 정책 설정
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- API 키 테이블 정책 (서버만 접근 가능)
CREATE POLICY "Service role can manage api_keys" ON api_keys
    FOR ALL USING (auth.role() = 'service_role');

-- 키워드 테이블 정책 (읽기는 모든 사용자, 쓰기는 서버만)
CREATE POLICY "Anyone can read keywords" ON keywords
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage keywords" ON keywords
    FOR ALL USING (auth.role() = 'service_role');

-- 문서수 테이블 정책 (읽기는 모든 사용자, 쓰기는 서버만)
CREATE POLICY "Anyone can read doc_counts" ON doc_counts
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage doc_counts" ON doc_counts
    FOR ALL USING (auth.role() = 'service_role');

-- 작업 큐 테이블 정책 (서버만 접근 가능)
CREATE POLICY "Service role can manage jobs" ON jobs
    FOR ALL USING (auth.role() = 'service_role');

-- 10. 트리거 함수 생성 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_keywords_updated_at ON keywords;
CREATE TRIGGER update_keywords_updated_at
    BEFORE UPDATE ON keywords
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 11. 일일 쿼터 리셋 함수
CREATE OR REPLACE FUNCTION reset_daily_quota()
RETURNS void AS $$
BEGIN
    UPDATE api_keys 
    SET used_today = 0, 
        window_tokens = 2.0,
        cooldown_until = NULL,
        last_error = NULL
    WHERE status != 'disabled';
END;
$$ LANGUAGE plpgsql;

-- 12. 샘플 데이터 삽입 (테스트용)
INSERT INTO api_keys (provider, label, key_id, key_secret, customer_id, qps_limit, daily_quota)
VALUES 
    ('searchad', 'test-searchad-1', 'test-access-license-1', 'test-secret-1', 'test-customer-1', 0.5, 1000),
    ('openapi', 'test-openapi-1', 'test-client-id-1', 'test-client-secret-1', NULL, 3.0, 5000)
ON CONFLICT DO NOTHING;

-- 13. 통계 함수 생성
CREATE OR REPLACE FUNCTION get_keyword_stats()
RETURNS TABLE (
    total_keywords BIGINT,
    queued_keywords BIGINT,
    processed_keywords BIGINT,
    error_keywords BIGINT,
    avg_sv NUMERIC,
    avg_cafe NUMERIC,
    avg_blog NUMERIC,
    avg_web NUMERIC,
    avg_news NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_keywords,
        COUNT(*) FILTER (WHERE status = 'queued') as queued_keywords,
        COUNT(*) FILTER (WHERE status = 'counted_docs') as processed_keywords,
        COUNT(*) FILTER (WHERE status = 'error') as error_keywords,
        AVG(COALESCE(pc, 0) + COALESCE(mo, 0)) as avg_sv,
        AVG((SELECT AVG(cafe_total) FROM doc_counts WHERE keyword_id = keywords.id)) as avg_cafe,
        AVG((SELECT AVG(blog_total) FROM doc_counts WHERE keyword_id = keywords.id)) as avg_blog,
        AVG((SELECT AVG(web_total) FROM doc_counts WHERE keyword_id = keywords.id)) as avg_web,
        AVG((SELECT AVG(news_total) FROM doc_counts WHERE keyword_id = keywords.id)) as avg_news
    FROM keywords;
END;
$$ LANGUAGE plpgsql;

-- 14. 설정 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '데이터베이스 설정이 완료되었습니다!';
    RAISE NOTICE '다음 단계:';
    RAISE NOTICE '1. 환경변수 설정 (ENVIRONMENT_SETUP.md 참조)';
    RAISE NOTICE '2. API 키 등록 (scripts/seed-api-keys.sql 실행)';
    RAISE NOTICE '3. 애플리케이션 배포 및 테스트';
END $$;
