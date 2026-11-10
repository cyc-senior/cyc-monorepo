import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { Public } from '../auth/decorators/public.decorator'
import { HealthStatusDto } from './dto/health-status.dto'
import { HealthService } from './health.service'

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness probe. */
  @Get()
  getHealth(): HealthStatusDto {
    return this.healthService.check()
  }
}
