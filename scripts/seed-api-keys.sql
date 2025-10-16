-- API 키 시드 데이터 삽입 스크립트
-- 환경변수에서 API 키 정보를 읽어와서 데이터베이스에 삽입합니다.

-- 기존 테스트 데이터 삭제 (선택사항)
-- DELETE FROM api_keys WHERE label LIKE 'test-%';

-- 1. 검색광고 API 키 삽입
-- 실제 키로 교체하세요
INSERT INTO api_keys (provider, label, key_id, key_secret, customer_id, qps_limit, daily_quota, status)
VALUES 
    ('searchad', 'searchad-key-1', 'your-access-license-1', 'your-secret-1', 'your-customer-id-1', 0.5, 8000, 'active'),
    ('searchad', 'searchad-key-2', 'your-access-license-2', 'your-secret-2', 'your-customer-id-2', 0.5, 8000, 'active')
ON CONFLICT (provider, label) DO UPDATE SET
    key_id = EXCLUDED.key_id,
    key_secret = EXCLUDED.key_secret,
    customer_id = EXCLUDED.customer_id,
    qps_limit = EXCLUDED.qps_limit,
    daily_quota = EXCLUDED.daily_quota,
    status = EXCLUDED.status,
    updated_at = NOW();

-- 2. 오픈API 키 삽입
-- 실제 키로 교체하세요
INSERT INTO api_keys (provider, label, key_id, key_secret, customer_id, qps_limit, daily_quota, status)
VALUES 
    ('openapi', 'openapi-key-1', 'your-client-id-1', 'your-client-secret-1', NULL, 3.0, 20000, 'active'),
    ('openapi', 'openapi-key-2', 'your-client-id-2', 'your-client-secret-2', NULL, 3.0, 20000, 'active')
ON CONFLICT (provider, label) DO UPDATE SET
    key_id = EXCLUDED.key_id,
    key_secret = EXCLUDED.key_secret,
    qps_limit = EXCLUDED.qps_limit,
    daily_quota = EXCLUDED.daily_quota,
    status = EXCLUDED.status,
    updated_at = NOW();

-- 3. API 키 상태 확인
SELECT 
    provider,
    label,
    status,
    qps_limit,
    daily_quota,
    used_today,
    CASE 
        WHEN cooldown_until IS NOT NULL AND cooldown_until > NOW() 
        THEN 'Cooling down until ' || cooldown_until::text
        ELSE 'Ready'
    END as availability,
    created_at
FROM api_keys
ORDER BY provider, label;

-- 4. API 키 통계
SELECT 
    provider,
    COUNT(*) as total_keys,
    COUNT(*) FILTER (WHERE status = 'active') as active_keys,
    COUNT(*) FILTER (WHERE status = 'cooling') as cooling_keys,
    COUNT(*) FILTER (WHERE status = 'disabled') as disabled_keys,
    SUM(daily_quota) as total_daily_quota,
    SUM(used_today) as total_used_today,
    ROUND(SUM(used_today)::numeric / NULLIF(SUM(daily_quota), 0) * 100, 2) as usage_percentage
FROM api_keys
GROUP BY provider
ORDER BY provider;