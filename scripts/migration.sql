-- 데이터베이스 마이그레이션 스크립트
-- 기존 데이터 보존하면서 스키마 업데이트

-- 1. 기존 테이블 백업 (필요시)
-- CREATE TABLE keywords_backup AS SELECT * FROM keywords;
-- CREATE TABLE doc_counts_backup AS SELECT * FROM doc_counts;

-- 2. 새로운 컬럼 추가 (기존 데이터에 영향 없음)
ALTER TABLE keywords 
ADD COLUMN IF NOT EXISTS ctr_pc NUMERIC,
ADD COLUMN IF NOT EXISTS ctr_mo NUMERIC,
ADD COLUMN IF NOT EXISTS ad_count INTEGER,
ADD COLUMN IF NOT EXISTS comp_idx TEXT,
ADD COLUMN IF NOT EXISTS depth INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'queued';

-- 3. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_keywords_status ON keywords(status);
CREATE INDEX IF NOT EXISTS idx_keywords_source ON keywords(source);
CREATE INDEX IF NOT EXISTS idx_keywords_parent ON keywords(parent_id);
CREATE INDEX IF NOT EXISTS idx_keywords_depth ON keywords(depth);

-- 4. 제약조건 추가
ALTER TABLE keywords 
ADD CONSTRAINT IF NOT EXISTS check_source CHECK (source IN ('seed', 'related')),
ADD CONSTRAINT IF NOT EXISTS check_status CHECK (status IN ('queued', 'fetched_rel', 'counted_docs', 'error'));

-- 5. 기존 데이터 정규화
UPDATE keywords 
SET term = LOWER(TRIM(term))
WHERE term != LOWER(TRIM(term));

-- 6. 기본값 설정
UPDATE keywords 
SET depth = 0 
WHERE depth IS NULL;

UPDATE keywords 
SET status = 'queued' 
WHERE status IS NULL;

-- 7. 뷰 재생성
DROP VIEW IF EXISTS keyword_latest_view;
CREATE VIEW keyword_latest_view AS
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

-- 8. 통계 정보 업데이트
ANALYZE keywords;
ANALYZE doc_counts;

-- 9. 마이그레이션 완료 로그
INSERT INTO jobs (type, payload, status, completed_at)
VALUES ('migration', '{"version": "1.0.0", "description": "Initial schema migration"}', 'completed', NOW())
ON CONFLICT DO NOTHING;
