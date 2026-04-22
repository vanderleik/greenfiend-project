export interface JwtAccessPayload {
  sub: string;
  email: string;
  isEmailVerified: boolean;
}

export interface JwtRefreshPayload {
  sub: string;
  sid: string;
  jti: string;
}
