import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtAccessPayload } from '../../auth/interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtAccessPayload => {
    const request = context
      .switchToHttp()
      .getRequest<{ user: JwtAccessPayload }>();
    return request.user;
  },
);
