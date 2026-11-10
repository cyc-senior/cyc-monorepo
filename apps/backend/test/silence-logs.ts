import { Logger } from '@nestjs/common'

// Services log every domain event; keep test output to test results.
Logger.overrideLogger(false)
