import {
  type ArgumentsHost,
  Body,
  Catch,
  ConflictException,
  Controller,
  Delete,
  type ExceptionFilter,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { sendProblem } from '../../../http/problem-details.js';
import { UserService } from '../../application/user.service.js';
import { DomainValidationError, type User } from '../../domain/user.js';
import { AdminGuard, AuthGuard, SelfOrAdminGuard } from './guards.js';
import {
  type ListQuery,
  listQuerySchema,
  type RegisterBody,
  registerSchema,
  type UpdateBody,
  updateSchema,
  userId,
} from './schemas.js';

/** Resposta HTTP: nunca o User do domínio direto (tem o hash da senha). */
export const toResponse = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  roles: u.roles,
  active: u.active,
  createdAt: u.createdAt.toISOString(),
});

@Catch(DomainValidationError)
export class DomainValidationFilter implements ExceptionFilter {
  catch(error: DomainValidationError, host: ArgumentsHost) {
    sendProblem(host, 400, error.message);
  }
}

@Controller('users')
@UseFilters(DomainValidationFilter)
export class UserController {
  constructor(private readonly users: UserService) {}

  @Post()
  async register(
    @Body({ schema: registerSchema }) body: RegisterBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.users.register(body);
    if (!result.ok)
      throw new ConflictException(`Email já cadastrado: ${result.email}`);
    res.location(`/api/users/${result.user.id}`);
    return toResponse(result.user);
  }

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  async list(@Query({ schema: listQuerySchema }) query: ListQuery) {
    const page = await this.users.list(query.page, query.size);
    return { ...page, items: page.items.map(toResponse) };
  }

  @Get(':id')
  @UseGuards(AuthGuard, SelfOrAdminGuard)
  async get(@Param('id', { schema: userId }) id: string) {
    return toResponse(orNotFound(await this.users.get(id)));
  }

  @Put(':id')
  @UseGuards(AuthGuard, SelfOrAdminGuard)
  async update(
    @Param('id', { schema: userId }) id: string,
    @Body({ schema: updateSchema }) body: UpdateBody,
  ) {
    return toResponse(orNotFound(await this.users.rename(id, body.name)));
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard, SelfOrAdminGuard)
  async delete(@Param('id', { schema: userId }) id: string) {
    orNotFound(await this.users.delete(id));
  }

  /** Assíncrono: grava no outbox e responde 202; o envio acontece via Kafka. */
  @Post(':id/welcome')
  @HttpCode(202)
  @UseGuards(AuthGuard, SelfOrAdminGuard)
  async welcome(@Param('id', { schema: userId }) id: string) {
    orNotFound(await this.users.requestWelcome(id));
  }
}

function orNotFound<T>(value: T | undefined | false): T {
  if (value === undefined || value === false) throw new NotFoundException();
  return value;
}
