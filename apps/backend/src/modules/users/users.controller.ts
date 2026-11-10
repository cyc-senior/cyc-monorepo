import { Body, Controller, Get, NotFoundException, Patch } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { User } from '../../generated/prisma/client'
import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface'
import { UpdateUserDto } from './dto/update-user.dto'
import { UserResponseDto } from './dto/user-response.dto'
import { UsersService } from './users.service'

@ApiTags('users')
@ApiAuthenticated()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get my profile.
   *
   * @remarks The user identified by the bearer token.
   * @throws {404} The token's user no longer exists.
   */
  @Get('me')
  async getMe(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findById(current.id)
    if (!user) {
      throw new NotFoundException('User not found.')
    }

    return this.toResponse(user)
  }

  /** Update my display name and avatar. */
  @Patch('me')
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.toResponse(await this.usersService.update(userId, dto))
  }

  private toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
    }
  }
}
