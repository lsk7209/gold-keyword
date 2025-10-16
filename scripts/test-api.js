#!/usr/bin/env node

/**
 * 네이버 키워드 수집 시스템 API 테스트 스크립트
 * 
 * 사용법:
 * node scripts/test-api.js [baseUrl] [serverToken]
 * 
 * 예시:
 * node scripts/test-api.js https://your-app.vercel.app your-server-token
 */

const https = require('https');
const http = require('http');

// 기본 설정
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_SERVER_TOKEN = 'test-token-123';

// 색상 출력을 위한 유틸리티
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// HTTP 요청 헬퍼 함수
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const req = client.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: jsonData
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);
        
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
}

// 테스트 결과 추적
const testResults = {
    passed: 0,
    failed: 0,
    total: 0
};

async function runTest(testName, testFunction) {
    testResults.total++;
    log(`\n🧪 ${testName}`, 'cyan');
    
    try {
        await testFunction();
        testResults.passed++;
        log(`✅ ${testName} - PASSED`, 'green');
    } catch (error) {
        testResults.failed++;
        log(`❌ ${testName} - FAILED`, 'red');
        log(`   Error: ${error.message}`, 'red');
    }
}

// 테스트 함수들
async function testHealthCheck(baseUrl, serverToken) {
    const response = await makeRequest(`${baseUrl}/api/admin/health`, {
        headers: {
            'Authorization': `Bearer ${serverToken}`
        }
    });
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.overall) {
        throw new Error('Health check response missing overall status');
    }
    
    log(`   Status: ${response.data.overall.status}`, 'blue');
    log(`   API Keys: ${response.data.apiKeys.searchad.length} searchad, ${response.data.apiKeys.openapi.length} openapi`, 'blue');
}

async function testSeedKeyword(baseUrl, serverToken) {
    const testKeyword = `test-keyword-${Date.now()}`;
    
    const response = await makeRequest(`${baseUrl}/api/seed`, {
        method: 'POST',
        body: {
            term: testKeyword,
            autoCollect: false
        }
    });
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    }
    
    if (!response.data.success) {
        throw new Error(`Seed keyword failed: ${response.data.error}`);
    }
    
    log(`   Keyword: ${testKeyword}`, 'blue');
    log(`   ID: ${response.data.keywordId}`, 'blue');
    
    return response.data.keywordId;
}

async function testKeywordsList(baseUrl) {
    const response = await makeRequest(`${baseUrl}/api/keywords?pageSize=10`);
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.keywords) {
        throw new Error('Keywords list response missing keywords array');
    }
    
    log(`   Found ${response.data.keywords.length} keywords`, 'blue');
    log(`   Total: ${response.data.total}`, 'blue');
}

async function testKeywordsStats(baseUrl) {
    const response = await makeRequest(`${baseUrl}/api/keywords`, {
        method: 'POST',
        body: {
            type: 'stats'
        }
    });
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.totalKeywords) {
        throw new Error('Stats response missing totalKeywords');
    }
    
    log(`   Total Keywords: ${response.data.totalKeywords}`, 'blue');
    log(`   Average SV: ${Math.round(response.data.averages.sv_total)}`, 'blue');
}

async function testManualCollection(baseUrl, serverToken) {
    const response = await makeRequest(`${baseUrl}/api/trigger/collect`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serverToken}`
        },
        body: {
            type: 'related',
            batchSize: 1
        }
    });
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    }
    
    if (!response.data.success) {
        throw new Error(`Manual collection failed: ${response.data.error}`);
    }
    
    log(`   Processed: ${response.data.processed} keywords`, 'blue');
}

async function testCSVExport(baseUrl) {
    const response = await makeRequest(`${baseUrl}/api/export/csv?limit=10`);
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.startsWith('키워드,총 검색수')) {
        throw new Error('CSV export does not start with expected header');
    }
    
    log(`   CSV size: ${response.data.length} characters`, 'blue');
}

async function testErrorHandling(baseUrl) {
    // 잘못된 키워드로 테스트
    const response = await makeRequest(`${baseUrl}/api/seed`, {
        method: 'POST',
        body: {
            term: '', // 빈 키워드
            autoCollect: false
        }
    });
    
    if (response.status === 200) {
        throw new Error('Expected error for empty keyword, but got success');
    }
    
    log(`   Error handling: ${response.status} (expected)`, 'blue');
}

// 메인 테스트 실행 함수
async function runAllTests(baseUrl, serverToken) {
    log('🚀 네이버 키워드 수집 시스템 API 테스트 시작', 'bright');
    log(`📍 Base URL: ${baseUrl}`, 'blue');
    log(`🔑 Server Token: ${serverToken.substring(0, 10)}...`, 'blue');
    
    // 기본 API 테스트
    await runTest('Health Check', () => testHealthCheck(baseUrl, serverToken));
    await runTest('Keywords List', () => testKeywordsList(baseUrl));
    await runTest('Keywords Stats', () => testKeywordsStats(baseUrl));
    await runTest('CSV Export', () => testCSVExport(baseUrl));
    await runTest('Error Handling', () => testErrorHandling(baseUrl));
    
    // 시드 키워드 테스트 (실제 데이터 생성)
    let keywordId;
    await runTest('Seed Keyword', async () => {
        keywordId = await testSeedKeyword(baseUrl, serverToken);
    });
    
    // 수동 수집 테스트 (시드 키워드가 있는 경우에만)
    if (keywordId) {
        await runTest('Manual Collection', () => testManualCollection(baseUrl, serverToken));
    }
    
    // 결과 요약
    log('\n📊 테스트 결과 요약', 'bright');
    log(`✅ 통과: ${testResults.passed}`, 'green');
    log(`❌ 실패: ${testResults.failed}`, 'red');
    log(`📈 총계: ${testResults.total}`, 'blue');
    
    if (testResults.failed === 0) {
        log('\n🎉 모든 테스트가 통과했습니다!', 'green');
        process.exit(0);
    } else {
        log('\n⚠️  일부 테스트가 실패했습니다.', 'yellow');
        process.exit(1);
    }
}

// 명령행 인수 처리
const args = process.argv.slice(2);
const baseUrl = args[0] || DEFAULT_BASE_URL;
const serverToken = args[1] || DEFAULT_SERVER_TOKEN;

// 테스트 실행
runAllTests(baseUrl, serverToken).catch(error => {
    log(`\n💥 테스트 실행 중 오류 발생: ${error.message}`, 'red');
    process.exit(1);
});
