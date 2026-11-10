import { logEvent } from './log-event'

describe('logEvent', () => {
  it('formats fields as key=value and drops undefined ones', () => {
    expect(
      logEvent('invite.created', {
        invite: 'i-1',
        maxUses: 10,
        label: undefined,
        revoked: false,
        at: new Date('2026-01-01T00:00:00Z'),
      }),
    ).toBe(
      'invite.created invite=i-1 maxUses=10 revoked=false at=2026-01-01T00:00:00.000Z',
    )
  })
})
