-- API 키 시드 데이터 삽입 스크립트
-- 환경변수에서 JSON 데이터를 파싱하여 api_keys 테이블에 삽입

-- 기존 API 키 삭제 (개발 환경에서만 사용)
-- DELETE FROM api_keys;

-- 네이버 오픈API 키 삽입 예시
-- 실제 환경에서는 환경변수 JSON을 파싱하여 동적으로 삽입
INSERT INTO api_keys (provider, label, key_id, key_secret, qps_limit, daily_quota, window_refill_rate)
VALUES 
  ('openapi', 'open-1', 'your_client_id_1', 'your_client_secret_1', 3, 20000, 3),
  ('openapi', 'open-2', 'your_client_id_2', 'your_client_secret_2', 3, 20000, 3),
  ('openapi', 'open-3', 'your_client_id_3', 'your_client_secret_3', 3, 20000, 3);

-- 네이버 검색광고 API 키 삽입 예시
INSERT INTO api_keys (provider, label, key_id, key_secret, customer_id, qps_limit, daily_quota, window_refill_rate)
VALUES 
  ('searchad', 'ad-1', 'your_access_license_1', 'your_secret_1', 'your_customer_id_1', 0.5, 8000, 0.5),
  ('searchad', 'ad-2', 'your_access_license_2', 'your_secret_2', 'your_customer_id_2', 0.5, 8000, 0.5);

-- API 키 상태 확인
SELECT 
  provider,
  label,
  status,
  qps_limit,
  daily_quota,
  used_today,
  cooldown_until,
  created_at
FROM api_keys
ORDER BY provider, label;
