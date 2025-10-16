import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatPercentage(num: number): string {
  return (num * 100).toFixed(1) + '%'
}

export function getCompetitionColor(compIdx: string): string {
  switch (compIdx) {
    case '낮음':
      return 'text-green-600'
    case '중간':
      return 'text-yellow-600'
    case '높음':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'queued':
      return 'status-queued'
    case 'fetched_rel':
      return 'status-fetched_rel'
    case 'counted_docs':
      return 'status-counted_docs'
    case 'error':
      return 'status-error'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function getCompetitionClass(compIdx: string): string {
  switch (compIdx) {
    case '낮음':
      return 'comp-low'
    case '중간':
      return 'comp-medium'
    case '높음':
      return 'comp-high'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function generateCSVDownloadUrl(
  baseUrl: string,
  params: Record<string, string | number | boolean>
): string {
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  })
  
  return `${baseUrl}?${searchParams.toString()}`
}

export function downloadCSV(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function parseSortString(sortString: string): Array<{column: string, direction: 'asc' | 'desc'}> {
  return sortString.split(',').map(clause => {
    const [column, direction] = clause.trim().split(':')
    return { column, direction: direction as 'asc' | 'desc' }
  })
}

export function buildSortString(sorts: Array<{column: string, direction: 'asc' | 'desc'}>): string {
  return sorts.map(sort => `${sort.column}:${sort.direction}`).join(',')
}

export function validateFilters(filters: Record<string, any>): Record<string, any> {
  const validated: Record<string, any> = {}
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'string' && value.trim()) {
        validated[key] = value.trim()
      } else if (typeof value === 'number' && !isNaN(value)) {
        validated[key] = value
      } else if (typeof value === 'boolean') {
        validated[key] = value
      }
    }
  })
  
  return validated
}

export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value))
    }
  })
  
  return searchParams.toString()
}

export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {}
  const searchParams = new URLSearchParams(queryString)
  
  searchParams.forEach((value, key) => {
    params[key] = value
  })
  
  return params
}
