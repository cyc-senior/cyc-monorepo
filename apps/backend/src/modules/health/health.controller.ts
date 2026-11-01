import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { Public } from '../auth/decorators/public.decorator'
import { HealthService, HealthStatus } from './health.service'

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ description: 'Service liveness probe.' })
  getHealth(): HealthStatus {
    return this.healthService.check()
  }
}
