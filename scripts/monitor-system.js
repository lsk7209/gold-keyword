#!/usr/bin/env node

/**
 * 네이버 키워드 수집 시스템 모니터링 스크립트
 * 
 * 사용법:
 * node scripts/monitor-system.js [baseUrl] [serverToken] [interval]
 * 
 * 예시:
 * node scripts/monitor-system.js https://your-app.vercel.app your-server-token 30
 */

const https = require('https');
const http = require('http');

// 기본 설정
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_SERVER_TOKEN = 'test-token-123';
const DEFAULT_INTERVAL = 60; // 60초

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
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${colors[color]}${message}${colors.reset}`);
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
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
}

// 모니터링 데이터 저장
let monitoringData = {
    startTime: new Date(),
    checks: 0,
    failures: 0,
    lastHealth: null,
    alerts: []
};

// 알림 함수
function alert(message, severity = 'warning') {
    const alert = {
        timestamp: new Date(),
        message,
        severity
    };
    
    monitoringData.alerts.push(alert);
    
    const color = severity === 'error' ? 'red' : severity === 'warning' ? 'yellow' : 'green';
    log(`🚨 ALERT [${severity.toUpperCase()}]: ${message}`, color);
}

// 헬스 체크 함수
async function checkHealth(baseUrl, serverToken) {
    try {
        const response = await makeRequest(`${baseUrl}/api/admin/health`, {
            headers: {
                'Authorization': `Bearer ${serverToken}`
            }
        });
        
        monitoringData.checks++;
        
        if (response.status !== 200) {
            monitoringData.failures++;
            alert(`Health check failed with status ${response.status}`, 'error');
            return null;
        }
        
        const health = response.data;
        monitoringData.lastHealth = health;
        
        // 상태 체크
        if (health.overall.status !== 'healthy') {
            alert(`System status: ${health.overall.status}`, 'warning');
        }
        
        // API 키 상태 체크
        const searchadKeys = health.apiKeys.searchad || [];
        const openapiKeys = health.apiKeys.openapi || [];
        
        const coolingKeys = [...searchadKeys, ...openapiKeys].filter(key => key.status === 'cooling');
        if (coolingKeys.length > 0) {
            alert(`${coolingKeys.length} API keys are cooling down`, 'warning');
        }
        
        const disabledKeys = [...searchadKeys, ...openapiKeys].filter(key => key.status === 'disabled');
        if (disabledKeys.length > 0) {
            alert(`${disabledKeys.length} API keys are disabled`, 'error');
        }
        
        // 429 비율 체크
        if (health.rateLimiting.rate429 > 5) {
            alert(`High 429 rate: ${health.rateLimiting.rate429}%`, 'warning');
        }
        
        // 큐 상태 체크
        const pendingJobs = health.queue.pending || 0;
        if (pendingJobs > 1000) {
            alert(`High queue backlog: ${pendingJobs} pending jobs`, 'warning');
        }
        
        return health;
        
    } catch (error) {
        monitoringData.failures++;
        alert(`Health check failed: ${error.message}`, 'error');
        return null;
    }
}

// 통계 출력 함수
function printStats(health) {
    if (!health) {
        log('No health data available', 'red');
        return;
    }
    
    log('📊 System Status:', 'bright');
    log(`   Overall: ${health.overall.status}`, health.overall.status === 'healthy' ? 'green' : 'yellow');
    log(`   Uptime: ${health.overall.uptime}`, 'blue');
    
    log('🔑 API Keys:', 'bright');
    log(`   SearchAd: ${health.apiKeys.searchad.length} total, ${health.apiKeys.searchad.filter(k => k.status === 'active').length} active`, 'blue');
    log(`   OpenAPI: ${health.apiKeys.openapi.length} total, ${health.apiKeys.openapi.filter(k => k.status === 'active').length} active`, 'blue');
    
    log('📈 Performance:', 'bright');
    log(`   429 Rate: ${health.rateLimiting.rate429}%`, health.rateLimiting.rate429 > 5 ? 'yellow' : 'green');
    log(`   Avg Response: ${health.performance.avgResponseTime}ms`, 'blue');
    log(`   Throughput: ${health.performance.throughput}/min`, 'blue');
    
    log('📋 Queue:', 'bright');
    log(`   Pending: ${health.queue.pending}`, 'blue');
    log(`   Processing: ${health.queue.processing}`, 'blue');
    log(`   Completed: ${health.queue.completed}`, 'blue');
    
    log('💾 Database:', 'bright');
    log(`   Keywords: ${health.database.keywords.total} total`, 'blue');
    log(`   Queued: ${health.database.keywords.queued}`, 'blue');
    log(`   Processed: ${health.database.keywords.processed}`, 'blue');
    log(`   Errors: ${health.database.keywords.errors}`, 'blue');
}

// 요약 통계 출력
function printSummary() {
    const uptime = Math.floor((new Date() - monitoringData.startTime) / 1000);
    const successRate = ((monitoringData.checks - monitoringData.failures) / monitoringData.checks * 100).toFixed(1);
    
    log('\n📊 Monitoring Summary:', 'bright');
    log(`   Runtime: ${Math.floor(uptime / 60)}m ${uptime % 60}s`, 'blue');
    log(`   Checks: ${monitoringData.checks}`, 'blue');
    log(`   Failures: ${monitoringData.failures}`, 'blue');
    log(`   Success Rate: ${successRate}%`, successRate > 95 ? 'green' : 'yellow');
    log(`   Alerts: ${monitoringData.alerts.length}`, 'blue');
    
    if (monitoringData.alerts.length > 0) {
        log('\n🚨 Recent Alerts:', 'bright');
        const recentAlerts = monitoringData.alerts.slice(-5);
        recentAlerts.forEach(alert => {
            const color = alert.severity === 'error' ? 'red' : 'yellow';
            log(`   [${alert.timestamp.toLocaleTimeString()}] ${alert.message}`, color);
        });
    }
}

// 메인 모니터링 루프
async function startMonitoring(baseUrl, serverToken, interval) {
    log('🚀 네이버 키워드 수집 시스템 모니터링 시작', 'bright');
    log(`📍 Base URL: ${baseUrl}`, 'blue');
    log(`🔑 Server Token: ${serverToken.substring(0, 10)}...`, 'blue');
    log(`⏱️  Check Interval: ${interval}초`, 'blue');
    log('Press Ctrl+C to stop monitoring\n', 'yellow');
    
    // 초기 헬스 체크
    await checkHealth(baseUrl, serverToken);
    
    // 주기적 모니터링
    const monitoringInterval = setInterval(async () => {
        log('─'.repeat(60), 'cyan');
        const health = await checkHealth(baseUrl, serverToken);
        printStats(health);
        printSummary();
    }, interval * 1000);
    
    // 종료 처리
    process.on('SIGINT', () => {
        clearInterval(monitoringInterval);
        log('\n🛑 모니터링을 중지합니다...', 'yellow');
        printSummary();
        process.exit(0);
    });
}

// 명령행 인수 처리
const args = process.argv.slice(2);
const baseUrl = args[0] || DEFAULT_BASE_URL;
const serverToken = args[1] || DEFAULT_SERVER_TOKEN;
const interval = parseInt(args[2]) || DEFAULT_INTERVAL;

// 모니터링 시작
startMonitoring(baseUrl, serverToken, interval).catch(error => {
    log(`💥 모니터링 시작 중 오류 발생: ${error.message}`, 'red');
    process.exit(1);
});
