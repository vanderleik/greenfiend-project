import { JwtAccessPayload } from './interfaces/jwt-payload.interface';

export interface AuthSuccessResponse {
  accessToken: string;
  user: JwtAccessPayload;
}
