import { can, Permission, ROLE_PERMISSIONS, rolesWith } from './permissions'

const ALL = Object.values(Permission)

describe('role permissions', () => {
  it('makes designers the owners of the project and its design', () => {
    expect(ALL.filter((p) => !can('DESIGNER', p))).toEqual([])
  })

  it.each(['PROJECT_MANAGER', 'PRODUCT_OWNER'] as const)(
    'lets a %s read everything and change nothing',
    (role) => {
      const granted = [...ROLE_PERMISSIONS[role]]

      expect(granted.filter((p) => !p.endsWith(':read'))).toEqual([])
      expect(ALL.filter((p) => p.endsWith(':read') && !can(role, p))).toEqual(
        [],
      )
    },
  )

  it('reserves every change to designers', () => {
    for (const permission of ALL.filter((p) => !p.endsWith(':read'))) {
      expect(rolesWith(permission)).toEqual(['DESIGNER'])
    }
  })

  it('lists roles from most to least privileged', () => {
    expect(rolesWith(Permission.DesignRead)).toEqual([
      'DESIGNER',
      'PROJECT_MANAGER',
      'PRODUCT_OWNER',
    ])
  })
})
