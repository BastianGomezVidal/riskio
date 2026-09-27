import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserProfileDto } from './dto/user-profile.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthPrincipal } from '../auth/auth.roles.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current account profile' })
  @ApiOkResponse({ description: 'User profile', type: UserProfileDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  getMe(@CurrentUser() principal: AuthPrincipal): Promise<UserProfileDto> {
    return this.users.findById(principal.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update the current account profile',
    description:
      'Updates firstName, lastName or phone. Email change lives in a ' +
      'dedicated endpoint with verification (Phase 7).',
  })
  @ApiOkResponse({ description: 'Updated user profile', type: UserProfileDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  updateMe(
    @CurrentUser() principal: AuthPrincipal,
    @Body() body: UpdateUserDto,
  ): Promise<UserProfileDto> {
    return this.users.updateMe(principal.id, body);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(
          file.mimetype,
        );
        cb(ok ? null : new Error('Only PNG, JPEG or WebP allowed'), ok);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload a new profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOkResponse({ description: 'Updated user profile', type: UserProfileDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  uploadAvatar(
    @CurrentUser() principal: AuthPrincipal,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserProfileDto> {
    return this.users.updateAvatar(principal.id, file);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete the current account',
    description:
      'Permanently deletes the account and its API tokens. The avatar ' +
      'file is removed from storage via the messaging broker.',
  })
  @ApiNoContentResponse({ description: 'Account deleted' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async deleteMe(@CurrentUser() principal: AuthPrincipal): Promise<void> {
    await this.users.deleteMe(principal.id);
  }
}
