import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { Session } from './entities/session.entity';
import {
  JwtAccessPayload,
  JwtRefreshPayload,
} from './interfaces/jwt-payload.interface';

interface LoginInput extends LoginDto {
  userAgent: string | null;
  ipAddress: string | null;
}

interface RefreshInput {
  refreshToken?: string;
  userAgent: string | null;
  ipAddress: string | null;
}

interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  user: JwtAccessPayload;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
    @InjectRepository(EmailVerificationToken)
    private readonly emailVerificationTokensRepository: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokensRepository: Repository<PasswordResetToken>,
    private readonly usersService: UsersService,
    private readonly channelsService: ChannelsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<void> {
    const existing = await this.usersService.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('Email is already registered.');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.createUser(dto.email, passwordHash);

    await this.channelsService.createForUser(user);

    const verifyToken = await this.createEmailVerificationToken(user);
    await this.mailService.sendVerificationEmail(user.email, verifyToken);

    this.logger.log(`User ${user.id} registered`);
  }

  async confirmEmail(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const entity = await this.emailVerificationTokensRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (
      !entity ||
      entity.consumedAt !== null ||
      entity.expiresAt <= new Date()
    ) {
      throw new BadRequestException('Invalid or expired confirmation token.');
    }

    entity.consumedAt = new Date();
    await this.emailVerificationTokensRepository.save(entity);
    await this.usersService.verifyEmail(entity.user.id);

    this.logger.log(`User ${entity.user.id} confirmed email`);
  }

  async login(input: LoginInput): Promise<AuthTokenPair> {
    const user = await this.usersService.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordOk = await argon2.verify(user.passwordHash, input.password);

    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('Email not verified.');
    }

    this.logger.log(`User ${user.id} logged in`);

    return this.issueTokensForUser(user, input.userAgent, input.ipAddress);
  }

  async refresh(input: RefreshInput): Promise<AuthTokenPair> {
    if (!input.refreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    let payload: JwtRefreshPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        input.refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const session = await this.sessionsRepository.findOne({
      where: { id: payload.sid },
      relations: { user: true },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (session.user.id !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const isTokenValid = await argon2.verify(
      session.refreshTokenHash,
      payload.jti,
    );

    if (!isTokenValid) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    session.revokedAt = new Date();
    await this.sessionsRepository.save(session);

    return this.issueTokensForUser(
      session.user,
      input.userAgent,
      input.ipAddress,
    );
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );

      await this.sessionsRepository.update(
        { id: payload.sid, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    } catch {
      // Intentionally ignored to avoid leaking token validity on logout.
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return;
    }

    const token = await this.createPasswordResetToken(user);
    await this.mailService.sendPasswordResetEmail(user.email, token);

    this.logger.log(`Password reset requested for user ${user.id}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const entity = await this.passwordResetTokensRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (
      !entity ||
      entity.consumedAt !== null ||
      entity.expiresAt <= new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    const passwordHash = await argon2.hash(newPassword);

    entity.consumedAt = new Date();
    await this.passwordResetTokensRepository.save(entity);
    await this.usersService.updatePassword(entity.user.id, passwordHash);
    await this.sessionsRepository.update(
      { userId: entity.user.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    this.logger.log(`Password reset finished for user ${entity.user.id}`);
  }

  async me(userId: string): Promise<JwtAccessPayload> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return this.toAccessPayload(user);
  }

  private async issueTokensForUser(
    user: User,
    userAgent: string | null,
    ipAddress: string | null,
  ): Promise<AuthTokenPair> {
    const refreshTokenId = randomBytes(32).toString('hex');
    const refreshTokenHash = await argon2.hash(refreshTokenId);

    const refreshTtlDays = this.configService.get<number>(
      'JWT_REFRESH_TTL_DAYS',
      7,
    );

    const session = await this.sessionsRepository.save(
      this.sessionsRepository.create({
        user,
        refreshTokenHash,
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
        revokedAt: null,
      }),
    );

    const accessPayload = this.toAccessPayload(user);
    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      sid: session.id,
      jti: refreshTokenId,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<number>('JWT_ACCESS_TTL_SECONDS', 900),
    });

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTtlDays * 24 * 60 * 60,
    });

    return {
      accessToken,
      refreshToken,
      user: accessPayload,
    };
  }

  private async createEmailVerificationToken(user: User): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');

    await this.emailVerificationTokensRepository.save(
      this.emailVerificationTokensRepository.create({
        user,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(
          Date.now() +
            this.configService.get<number>('EMAIL_VERIFY_TOKEN_TTL_HOURS', 24) *
              60 *
              60 *
              1000,
        ),
        consumedAt: null,
      }),
    );

    return rawToken;
  }

  private async createPasswordResetToken(user: User): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');

    await this.passwordResetTokensRepository.save(
      this.passwordResetTokensRepository.create({
        user,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(
          Date.now() +
            this.configService.get<number>(
              'PASSWORD_RESET_TOKEN_TTL_MINUTES',
              30,
            ) *
              60 *
              1000,
        ),
        consumedAt: null,
      }),
    );

    return rawToken;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAccessPayload(user: User): JwtAccessPayload {
    if (!user.isEmailVerified) {
      throw new ForbiddenException('Email not verified.');
    }

    return {
      sub: user.id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
    };
  }
}
