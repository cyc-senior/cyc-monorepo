import { ConfigService } from '@nestjs/config'
import { Cache, createCache } from 'cache-manager'

import { EnvironmentVariables } from '../config/env.validation'
import { HttpCacheService } from './http-cache.service'

describe('HttpCacheService', () => {
  const config = (ttlSeconds: number) =>
    ({ get: () => ttlSeconds }) as unknown as ConfigService<
      EnvironmentVariables,
      true
    >
  let cache: Cache
  let service: HttpCacheService

  beforeEach(() => {
    cache = createCache()
    service = new HttpCacheService(cache, config(60))
  })

  const key = (projectId = 'proj-1', who = 'u-1:PRODUCT_OWNER') =>
    service.responseKey(projectId, who, '/api/x')

  it('keeps the key stable until the project changes', async () => {
    const first = await key()

    expect(await key()).toBe(first)
    await service.invalidate('proj-1')
    expect(await key()).not.toBe(first)
  })

  it('invalidates only the project that changed', async () => {
    const other = await key('proj-2')

    await service.invalidate('proj-1')

    expect(await key('proj-2')).toBe(other)
  })

  it('separates callers and roles', async () => {
    expect(await key('proj-1', 'u-1:PRODUCT_OWNER')).not.toBe(
      await key('proj-1', 'u-2:PRODUCT_OWNER'),
    )
    expect(await key('proj-1', 'u-1:PRODUCT_OWNER')).not.toBe(
      await key('proj-1', 'u-1:DESIGNER'),
    )
  })

  it('fails open when the store hangs', async () => {
    jest.useFakeTimers()
    const hanging = new Promise<never>(() => undefined)
    const stuck = {
      get: () => hanging,
      mget: () => hanging,
      set: () => hanging,
    } as unknown as Cache
    service = new HttpCacheService(stuck, config(60))

    const pending = Promise.all([key(), service.get('k')])
    await jest.advanceTimersByTimeAsync(300)

    await expect(pending).resolves.toEqual([undefined, undefined])
    jest.useRealTimers()
  })

  it('skips a store that is down, probing it only every few seconds', async () => {
    jest.useFakeTimers()
    const mget = jest.fn(() => new Promise<never>(() => undefined))
    service = new HttpCacheService(
      { mget, get: jest.fn(), set: jest.fn() } as unknown as Cache,
      config(60),
    )
    service.watchStore(() => false)

    const probe = key()
    await jest.advanceTimersByTimeAsync(300)
    await expect(probe).resolves.toBeUndefined()
    await expect(key()).resolves.toBeUndefined()
    expect(mget).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(5_000)
    void key()
    expect(mget).toHaveBeenCalledTimes(2)
    jest.useRealTimers()
  })

  it('is disabled with a zero TTL', () => {
    expect(new HttpCacheService(cache, config(0)).enabled).toBe(false)
  })
})
