import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Channel } from './entities/channel.entity';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelsRepository: Repository<Channel>,
  ) {}

  private toBaseSlug(email: string): string {
    const prefix = email.split('@')[0] ?? 'channel';

    return (
      prefix
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'channel'
    );
  }

  async createForUser(user: User): Promise<Channel> {
    const baseSlug = this.toBaseSlug(user.email);
    let suffix = 0;

    while (suffix < 10_000) {
      const slug = suffix === 0 ? baseSlug : `${baseSlug}-${suffix}`;
      const existing = await this.channelsRepository.exists({
        where: { slug },
      });

      if (!existing) {
        const channel = this.channelsRepository.create({
          slug,
          displayName: slug,
          owner: user,
        });

        return this.channelsRepository.save(channel);
      }

      suffix += 1;
    }

    throw new Error('Could not allocate unique channel slug.');
  }
}
