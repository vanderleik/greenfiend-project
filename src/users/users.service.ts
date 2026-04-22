import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async createUser(email: string, passwordHash: string): Promise<User> {
    const user = this.usersRepository.create({
      email: email.trim().toLowerCase(),
      passwordHash,
      isEmailVerified: false,
    });

    return this.usersRepository.save(user);
  }

  async verifyEmail(userId: string): Promise<void> {
    await this.usersRepository.update(
      { id: userId },
      { isEmailVerified: true },
    );
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update({ id: userId }, { passwordHash });
  }
}
