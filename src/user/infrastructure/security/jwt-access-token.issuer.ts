import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../../config.js';
import { AccessTokenIssuer } from '../../application/ports.js';
import type { Role, User } from '../../domain/user.js';

/** Claims do access token: sub = id do usuário, roles = papéis. */
export interface AccessClaims {
  sub: string;
  roles: Role[];
}

@Injectable()
export class JwtAccessTokenIssuer extends AccessTokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  async issue(user: User) {
    const expiresInSeconds = this.config.get('ACCESS_TTL_SECONDS', {
      infer: true,
    });
    const token = await this.jwt.signAsync(
      { roles: [...user.roles] },
      { subject: user.id, expiresIn: expiresInSeconds },
    );
    return { token, expiresInSeconds };
  }
}
