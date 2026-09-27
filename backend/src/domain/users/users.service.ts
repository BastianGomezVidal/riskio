import {
  BadRequestException,
  Inject,
  Injectable,
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
import { OrphanCleanupConsumer } from '../messaging/orphan-cleanup.consumer.js';
import type { IMessageBroker } from '../messaging/adapter/interface/messaging-broker.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,

    @Inject(MESSAGE_BROKER)
    private readonly broker: IMessageBroker,
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

    await this.usersRepository.manager.transaction(async (manager) => {
      // Enqueue avatar cleanup (only if there is one).
      if (user.avatarUrl) {
        const key = this.storage.extractKey(user.avatarUrl);
        if (key) {
          await this.broker.publish(OrphanCleanupConsumer.topic(), {
            type: 'avatar',
            key,
          });
        }
      }
      await manager.remove(user);
    });
  }
}
