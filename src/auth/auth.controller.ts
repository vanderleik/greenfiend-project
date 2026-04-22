import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  AUTH_COOKIE_ACCESS,
  AUTH_COOKIE_REFRESH,
} from '../common/constants/auth.constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtAccessPayload } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto) {
    await this.authService.register(dto);

    return {
      message: 'Registration successful. Please verify your email.',
    };
  }

  @Get('confirm-email')
  async confirmEmail(@Query() dto: ConfirmEmailDto) {
    await this.authService.confirmEmail(dto.token);

    return {
      message: 'Email successfully confirmed.',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Ip() ipAddress: string,
  ) {
    const result = await this.authService.login({
      email: dto.email,
      password: dto.password,
      userAgent: request.headers['user-agent'] ?? null,
      ipAddress,
    });

    this.setAuthCookies(response, result.accessToken, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Ip() ipAddress: string,
  ) {
    const tokenFromCookie = request.cookies?.[AUTH_COOKIE_REFRESH] as
      | string
      | undefined;

    const result = await this.authService.refresh({
      refreshToken: dto.refreshToken ?? tokenFromCookie,
      userAgent: request.headers['user-agent'] ?? null,
      ipAddress,
    });

    this.setAuthCookies(response, result.accessToken, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: RefreshTokenDto,
  ) {
    const tokenFromCookie = request.cookies?.[AUTH_COOKIE_REFRESH] as
      | string
      | undefined;

    await this.authService.logout(dto.refreshToken ?? tokenFromCookie);

    this.clearAuthCookies(response);

    return {
      message: 'Logout successful.',
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);

    return {
      message: 'If your email exists, a password reset link has been sent.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);

    return {
      message: 'Password updated successfully.',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: JwtAccessPayload) {
    return {
      user,
    };
  }

  private setAuthCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const secure = process.env.NODE_ENV === 'production';

    response.cookie(AUTH_COOKIE_ACCESS, accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    response.cookie(AUTH_COOKIE_REFRESH, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookies(response: Response): void {
    response.clearCookie(AUTH_COOKIE_ACCESS, { path: '/' });
    response.clearCookie(AUTH_COOKIE_REFRESH, { path: '/' });
  }
}
