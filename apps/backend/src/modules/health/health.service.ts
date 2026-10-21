import { Injectable } from '@nestjs/common'

export interface HealthStatus {
  status: string
  uptime: number
  timestamp: string
}

@Injectable()
export class HealthService {
  check(): HealthStatus {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }
  }
}
