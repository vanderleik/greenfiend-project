import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_REFRESH } from '../src/common/constants/auth.constants';
import { MailService } from '../src/mail/mail.service';
import { Channel } from '../src/channels/entities/channel.entity';
import { User } from '../src/users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { setupApp } from '../src/app.setup';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let mailService: MailService;
  let dataSource: DataSource;

  interface LoginResponseBody {
    accessToken: string;
    user: {
      email: string;
    };
  }

  interface SimpleMessageBody {
    message: string;
  }

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_TYPE = 'sqlite';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-123456';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-123456';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app, app.get(ConfigService));
    await app.init();

    mailService = app.get(MailService);
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  it('registro cria usuario e canal automaticamente', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'john@example.com', password: 'StrongPass123!' })
      .expect(201);

    const user = await dataSource
      .getRepository(User)
      .findOne({ where: { email: 'john@example.com' } });
    expect(user).toBeTruthy();
    expect(user?.isEmailVerified).toBe(false);

    const channel = await dataSource
      .getRepository(Channel)
      .createQueryBuilder('channel')
      .leftJoin('channel.owner', 'owner')
      .where('owner.email = :email', { email: 'john@example.com' })
      .getOne();

    expect(channel).toBeTruthy();
    expect(channel?.slug).toBe('john');
  });

  it('bloqueia cadastro duplicado', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'dupe@example.com', password: 'StrongPass123!' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'dupe@example.com', password: 'StrongPass123!' })
      .expect(409);
  });

  it('nao permite login antes da confirmacao', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'pending@example.com', password: 'StrongPass123!' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'pending@example.com', password: 'StrongPass123!' })
      .expect(403);
  });

  it('confirma conta e permite login + me + refresh + logout', async () => {
    const email = 'verified@example.com';

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'StrongPass123!' })
      .expect(201);

    const verifyToken = mailService.peekVerificationToken(email);
    expect(verifyToken).toBeTruthy();

    await request(app.getHttpServer())
      .get('/api/auth/confirm-email')
      .query({ token: verifyToken })
      .expect(200);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'StrongPass123!' })
      .expect(200);

    const loginBody = loginResponse.body as LoginResponseBody;

    expect(loginBody.user.email).toBe(email);
    const accessToken = loginBody.accessToken;
    expect(accessToken).toBeTruthy();

    const cookies = loginResponse.headers['set-cookie'] as string[];
    expect(cookies).toBeDefined();

    const refreshCookie = cookies.find((cookie: string) =>
      cookie.startsWith(`${AUTH_COOKIE_REFRESH}=`),
    );
    expect(refreshCookie).toBeDefined();

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookies)
      .expect(200);

    const refreshBody = refreshResponse.body as Pick<
      LoginResponseBody,
      'accessToken'
    >;
    expect(refreshBody.accessToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', refreshResponse.headers['set-cookie'])
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshResponse.headers['set-cookie'])
      .expect(401);
  });

  it('rejeita confirmacao com token invalido', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/confirm-email')
      .query({ token: 'invalid-token' })
      .expect(400);
  });

  it('fluxo de forgot/reset invalida senha anterior', async () => {
    const email = 'reset@example.com';

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'StrongPass123!' })
      .expect(201);

    const verifyToken = mailService.peekVerificationToken(email);

    await request(app.getHttpServer())
      .get('/api/auth/confirm-email')
      .query({ token: verifyToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(200);

    const resetToken = mailService.peekResetToken(email);
    expect(resetToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: 'invalid-token', newPassword: 'AnotherPass123!' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: resetToken, newPassword: 'AnotherPass123!' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'StrongPass123!' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'AnotherPass123!' })
      .expect(200);
  });

  it('forgot password para email inexistente retorna resposta generica', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'notfound@example.com' })
      .expect(200)
      .expect((response) => {
        const body = response.body as SimpleMessageBody;
        expect(body.message).toContain('If your email exists');
      });
  });

  it('valida payload invalido no cadastro', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'bad-email', password: '123' })
      .expect(400);
  });

  it('aplica throttling em tentativas de login invalidas', async () => {
    const email = 'ratelimit@example.com';

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'StrongPass123!' })
      .expect(201);

    const verifyToken = mailService.peekVerificationToken(email);
    await request(app.getHttpServer())
      .get('/api/auth/confirm-email')
      .query({ token: verifyToken })
      .expect(200);

    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: `WrongPass${i}` })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'WrongPass999' })
      .expect(429);
  });
});
