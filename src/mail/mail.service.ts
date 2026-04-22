import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

type NodemailerModule = {
  createTransport(options: {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
    jsonTransport?: boolean;
  }): MailTransport;
};

const nodemailerModule = nodemailer as NodemailerModule;

type MailTransport = {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<void>;
  close(): void;
};

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: MailTransport;
  private readonly from: string;
  private readonly appBaseUrl: string;
  private readonly verificationTokens = new Map<string, string>();
  private readonly resetTokens = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {
    const mode = this.configService.get<string>('MAIL_TRANSPORT', 'json');

    this.from = this.configService.get<string>(
      'MAIL_FROM',
      'no-reply@greenfield.local',
    );
    this.appBaseUrl = this.configService.get<string>(
      'APP_BASE_URL',
      'http://localhost:3000',
    );

    if (mode === 'smtp') {
      const transport = nodemailerModule.createTransport({
        host: this.configService.get<string>('MAIL_HOST', 'localhost'),
        port: this.configService.get<number>('MAIL_PORT', 587),
        secure: false,
        auth: {
          user: this.configService.get<string>('MAIL_USER', ''),
          pass: this.configService.get<string>('MAIL_PASSWORD', ''),
        },
      });
      this.transporter = {
        sendMail: async (options) => {
          await transport.sendMail(options);
        },
        close: () => {
          transport.close();
        },
      };
      return;
    }

    const transport = nodemailerModule.createTransport({ jsonTransport: true });
    this.transporter = {
      sendMail: async (options) => {
        await transport.sendMail(options);
      },
      close: () => {
        transport.close();
      },
    };
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${this.appBaseUrl}/api/auth/confirm-email?token=${encodeURIComponent(token)}`;

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Confirm your account',
      text: `Confirm your account using this link: ${verifyUrl}`,
    });

    this.logger.log(`Verification email queued for ${email}`);
    this.verificationTokens.set(email.toLowerCase(), token);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Reset your password',
      text: `Reset your password using this link: ${resetUrl}`,
    });

    this.logger.log(`Reset email queued for ${email}`);
    this.resetTokens.set(email.toLowerCase(), token);
  }

  peekVerificationToken(email: string): string | undefined {
    return this.verificationTokens.get(email.toLowerCase());
  }

  peekResetToken(email: string): string | undefined {
    return this.resetTokens.get(email.toLowerCase());
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
