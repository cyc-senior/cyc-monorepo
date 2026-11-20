import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags } from '@nestjs/swagger'
import { Response } from 'express'

import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { User } from '../../generated/prisma/client'
import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface'
import {
  ORG_AVATAR_MAX_BYTES,
  UploadedAvatar,
} from '../organizations/organization-avatar'
import { UpdateUserDto } from './dto/update-user.dto'
import { UserResponseDto } from './dto/user-response.dto'
import { UsersService } from './users.service'

const MINUTE = 60_000

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

  /**
   * Update my display name and photo.
   *
   * @remarks Setting `image` (a URL, or null to remove the photo) replaces any
   *   uploaded photo.
   */
  @Patch('me')
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.toResponse(await this.usersService.update(userId, dto))
  }

  /**
   * Upload (or replace) my profile photo as multipart/form-data with a `file`
   * field. PNG and JPG, at most 1 MiB. The returned `image` is its URL.
   */
  @Post('me/picture')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ORG_AVATAR_MAX_BYTES, files: 1 },
    }),
  )
  async uploadPicture(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: UploadedAvatar,
  ): Promise<UserResponseDto> {
    return this.toResponse(await this.usersService.uploadPicture(userId, file))
  }

  /**
   * A user's uploaded photo. Public so that `<img src>` works; the `key` from
   * `image` is unguessable and rotates whenever the photo is replaced or
   * removed.
   */
  @Public()
  @Get(':userId/picture')
  @RateLimit({ limit: 120, windowMs: MINUTE })
  async picture(
    @UuidParam('userId') userId: string,
    @Query('key') key: string,
    @Res() response: Response,
  ): Promise<void> {
    const avatar = await this.usersService.picture(userId, key ?? '')
    if (!avatar) {
      throw new NotFoundException('Profile picture not found.')
    }
    response.type(avatar.contentType).send(Buffer.from(avatar.data))
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
