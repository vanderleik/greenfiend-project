import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { ChannelsService } from '../channels/channels.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { Session } from './entities/session.entity';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const verifyEmailSpy = jest.fn();
  const sendPasswordResetEmailSpy = jest.fn();
  const findByEmailMock = jest.fn();
  const createUserMock = jest.fn();
  const updatePasswordMock = jest.fn();
  const findByIdMock = jest.fn();
  const findOneSessionMock = jest.fn();
  const saveSessionMock = jest.fn();
  const updateSessionMock = jest.fn();
  const findOneVerificationMock = jest.fn();
  const saveVerificationMock = jest.fn();
  const findOneResetMock = jest.fn();
  const saveResetMock = jest.fn();
  const createChannelMock = jest.fn();
  const signAsyncMock = jest.fn();
  const verifyAsyncMock = jest.fn();

  const sessionsRepository = {
    save: saveSessionMock,
    findOne: findOneSessionMock,
    update: updateSessionMock,
  } as unknown as jest.Mocked<Repository<Session>>;

  const emailVerificationRepository = {
    save: saveVerificationMock,
    findOne: findOneVerificationMock,
    create: jest.fn(
      (value: Partial<EmailVerificationToken>) =>
        value as EmailVerificationToken,
    ),
  } as unknown as jest.Mocked<Repository<EmailVerificationToken>>;

  const passwordResetRepository = {
    save: saveResetMock,
    findOne: findOneResetMock,
    create: jest.fn(
      (value: Partial<PasswordResetToken>) => value as PasswordResetToken,
    ),
  } as unknown as jest.Mocked<Repository<PasswordResetToken>>;

  const usersService = {
    findByEmail: findByEmailMock,
    createUser: createUserMock,
    verifyEmail: verifyEmailSpy,
    updatePassword: updatePasswordMock,
    findById: findByIdMock,
  } as unknown as jest.Mocked<UsersService>;

  const channelsService = {
    createForUser: createChannelMock,
  } as unknown as jest.Mocked<ChannelsService>;

  const jwtService = {
    signAsync: signAsyncMock,
    verifyAsync: verifyAsyncMock,
  } as unknown as jest.Mocked<JwtService>;

  const configService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const map: Record<string, unknown> = {
        JWT_ACCESS_SECRET: 'access-secret-123456',
        JWT_REFRESH_SECRET: 'refresh-secret-123456',
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL_DAYS: 7,
        EMAIL_VERIFY_TOKEN_TTL_HOURS: 24,
        PASSWORD_RESET_TOKEN_TTL_MINUTES: 30,
      };

      return map[key] ?? defaultValue;
    }),
  } as unknown as jest.Mocked<ConfigService>;

  const mailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: sendPasswordResetEmailSpy,
  } as unknown as jest.Mocked<MailService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Session), useValue: sessionsRepository },
        {
          provide: getRepositoryToken(EmailVerificationToken),
          useValue: emailVerificationRepository,
        },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: passwordResetRepository,
        },
        { provide: UsersService, useValue: usersService },
        { provide: ChannelsService, useValue: channelsService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    verifyEmailSpy.mockClear();
    sendPasswordResetEmailSpy.mockClear();
  });

  it('falha ao registrar email duplicado', async () => {
    findByEmailMock.mockResolvedValue({ id: 'u1' });

    await expect(
      service.register({
        email: 'john@example.com',
        password: 'StrongPass123!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirma email com token valido', async () => {
    const user = { id: 'u1', isEmailVerified: false } as User;

    findOneVerificationMock.mockResolvedValue({
      id: 't1',
      user,
      tokenHash: 'h',
      expiresAt: new Date(Date.now() + 10000),
      consumedAt: null,
      createdAt: new Date(),
    });

    await service.confirmEmail('raw-token');

    expect(verifyEmailSpy).toHaveBeenCalledWith('u1');
  });

  it('falha em login com email nao verificado', async () => {
    findByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      passwordHash: await argon2.hash('StrongPass123!'),
      isEmailVerified: false,
    });

    await expect(
      service.login({
        email: 'john@example.com',
        password: 'StrongPass123!',
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('falha em refresh sem token', async () => {
    await expect(
      service.refresh({
        refreshToken: undefined,
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('falha reset com token invalido', async () => {
    findOneResetMock.mockResolvedValue(null);

    await expect(
      service.resetPassword('invalid-token', 'NewStrongPass123!'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forgot password nao revela existencia de email', async () => {
    findByEmailMock.mockResolvedValue(null);

    await service.forgotPassword('not-found@example.com');

    expect(sendPasswordResetEmailSpy).not.toHaveBeenCalled();
  });
});
