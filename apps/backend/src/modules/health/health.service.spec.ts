import { HealthService } from './health.service'

describe('HealthService', () => {
  let service: HealthService

  beforeEach(() => {
    service = new HealthService()
  })

  describe('check', () => {
    it('should report an ok status', () => {
      expect(service.check().status).toBe('ok')
    })

    it('should include uptime and a timestamp', () => {
      const result = service.check()

      expect(result.uptime).toBeGreaterThan(0)
      expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date')
    })
  })
})
