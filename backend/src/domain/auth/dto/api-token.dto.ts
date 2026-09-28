import { ApiProperty } from '@nestjs/swagger';

/**
 * An API token as the client is allowed to see it.
 *
 * This exists because the list endpoint used to return the entity, and the
 * entity carries `tokenHash` — the SHA-256 digest used to verify a token. That
 * digest is not the credential: the secret is 32 random bytes, so it cannot be
 * reversed. But it is a password-equivalent verifier, and shipping it to every
 * browser that opens the token list turns any later XSS or log leak from "a
 * label leaked" into "an offline guessing oracle".
 *
 * The service docstring already claimed "metadata only" while sending the hash,
 * which is exactly the kind of drift a DTO and a spec are for.
 */
export class ApiTokenDto {
  @ApiProperty({ description: 'Token UUID' })
  id: string;

  @ApiProperty({ description: 'Human-readable label' })
  name: string;

  @ApiProperty({ description: 'Non-secret display prefix' })
  prefix: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last use timestamp', nullable: true })
  lastUsedAt: Date | null;
}
