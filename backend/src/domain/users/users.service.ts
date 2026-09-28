import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserProfileDto } from './dto/user-profile.dto.js';
import { STORAGE_SERVICE } from '../storage/storage.tokens.js';
import type { StorageService } from '../storage/storage.service.js';
import { MESSAGE_BROKER } from '../messaging/adapter/types/message-broker.token.js';
import type { IMessageBroker } from '../messaging/adapter/interface/messaging-broker.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
  ) {}

  async findById(id: string): Promise<UserProfileDto> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.toProfile(user);
  }

  async updateMe(id: string, patch: UpdateUserDto): Promise<UserProfileDto> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (patch.firstName !== undefined) user.firstName = patch.firstName;
    if (patch.lastName !== undefined) user.lastName = patch.lastName;
    if (patch.phone !== undefined) user.phone = patch.phone;

    await this.usersRepository.save(user);
    return this.toProfile(user);
  }

  async updateAvatar(
    id: string,
    file: Express.Multer.File,
  ): Promise<UserProfileDto> {
    if (!file) {
      throw new BadRequestException('Missing file');
    }

    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const ext = file.originalname.split('.').pop() ?? 'png';
    const key = `avatars/${id}-${Date.now()}.${ext}`;

    const url = await this.storage.upload(key, file.buffer, file.mimetype);
    user.avatarUrl = url;
    await this.usersRepository.save(user);

    return this.toProfile(user);
  }

  private toProfile(user: User): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      lastLoginBrowser: user.lastLoginBrowser,
      lastLoginOs: user.lastLoginOs,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async deleteMe(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const avatarKey = user.avatarUrl
      ? this.storage.extractKey(user.avatarUrl)
      : null;

    await this.usersRepository.manager.transaction(async (manager) => {
      await manager.remove(user);
    });

    // The avatar is deleted after the transaction commits, not inside it.
    //
    // This used to go through the broker, which never delivered: the API
    // publishes and the worker consumes, each with its own in-memory queue, so
    // every deleted account left its avatar behind (D5). Calling storage
    // directly removes the hop that could not work.
    //
    // Order matters. Deleting inside the transaction would destroy the avatar
    // even if the row removal then rolled back, losing data for an account that
    // still exists. This way a database failure leaves the avatar alone, and a
    // storage failure leaves an orphan — recoverable, unlike a deleted file
    // for a live user.
    if (avatarKey) {
      try {
        await this.storage.delete(avatarKey);
      } catch (err) {
        // Surfaced as a log line rather than an error: the account is already
        // gone, and failing the request now would tell the user their deletion
        // did not happen when it did.
        this.logger.error(
          `Account ${id} deleted but its avatar ${avatarKey} could not be: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
