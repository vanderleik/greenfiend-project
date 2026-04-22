import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AUTH_COOKIE_ACCESS } from '../../common/constants/auth.constants';
import { JwtAccessPayload } from '../interfaces/jwt-payload.interface';

function cookieTokenExtractor(request: Request | undefined): string | null {
  if (!request) {
    return null;
  }

  const cookies = request.cookies as Record<string, string> | undefined;
  return cookies?.[AUTH_COOKIE_ACCESS] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieTokenExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_ACCESS_SECRET',
        'dev-access-secret-change-me',
      ),
    });
  }

  validate(payload: JwtAccessPayload): JwtAccessPayload {
    return payload;
  }
}
