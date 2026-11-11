import { Module } from '@nestjs/common'

import { HandoffService } from './handoff.service'
import { ProjectInsightsService } from './project-insights.service'
import { ReportsController } from './reports.controller'
import { ReportsService } from './reports.service'
import { SharedRoundsService } from './shared-rounds.service'
import { StakeholdersController } from './stakeholders.controller'

@Module({
  controllers: [StakeholdersController, ReportsController],
  providers: [
    SharedRoundsService,
    HandoffService,
    ProjectInsightsService,
    ReportsService,
  ],
})
export class StakeholdersModule {}
