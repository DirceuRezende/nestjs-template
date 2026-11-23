import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, type TokenPair } from '../../application/auth.service.js';
import {
  type LoginBody,
  loginSchema,
  type RefreshBody,
  refreshSchema,
} from './schemas.js';

const toResponse = (pair: TokenPair | undefined, failure: string) => {
  if (!pair) throw new UnauthorizedException(failure);
  return {
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    tokenType: 'Bearer',
    expiresIn: pair.expiresInSeconds,
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body({ schema: loginSchema }) body: LoginBody) {
    return toResponse(
      await this.auth.login(body.email, body.password),
      'Credenciais inválidas',
    );
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body({ schema: refreshSchema }) body: RefreshBody) {
    return toResponse(
      await this.auth.refresh(body.refreshToken),
      'Refresh token inválido ou expirado',
    );
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body({ schema: refreshSchema }) body: RefreshBody) {
    await this.auth.logout(body.refreshToken);
  }
}
