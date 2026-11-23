import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import type { AccessClaims } from '../security/jwt-access-token.issuer.js';

type AuthedRequest = Request & { principal?: AccessClaims };

const principalOf = (context: ExecutionContext): AccessClaims => {
  const principal = context
    .switchToHttp()
    .getRequest<AuthedRequest>().principal;
  if (!principal) throw new Error('AuthGuard precisa rodar antes'); // erro de wiring, não do cliente
  return principal;
};

/** Exige `Authorization: Bearer <jwt>` válido (assinatura HS256 + exp). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    try {
      if (scheme !== 'Bearer' || !token) throw new Error('sem bearer');
      const claims = await this.jwt.verifyAsync<AccessClaims>(token);
      req.principal = { sub: claims.sub, roles: claims.roles ?? [] };
      return true;
    } catch {
      http.getResponse<Response>().setHeader('WWW-Authenticate', 'Bearer');
      throw new UnauthorizedException();
    }
  }
}

/** Só ADMIN. Use depois do AuthGuard. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (!principalOf(context).roles.includes('ADMIN'))
      throw new ForbiddenException();
    return true;
  }
}

/** ADMIN ou o próprio usuário do :id. Roda antes de validar o id: id malformado de outra pessoa dá 403. */
@Injectable()
export class SelfOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const { sub, roles } = principalOf(context);
    const id = context.switchToHttp().getRequest<Request>().params.id;
    if (sub !== id && !roles.includes('ADMIN')) throw new ForbiddenException();
    return true;
  }
}
