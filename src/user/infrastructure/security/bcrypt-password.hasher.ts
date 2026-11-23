import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PasswordHasher } from '../../application/ports.js';
import { PasswordHash } from '../../domain/user.js';

@Injectable()
export class BcryptPasswordHasher extends PasswordHasher {
  async hash(raw: string) {
    return new PasswordHash(await bcrypt.hash(raw, 10));
  }

  matches(hash: PasswordHash, raw: string) {
    return bcrypt.compare(raw, hash.value);
  }
}
