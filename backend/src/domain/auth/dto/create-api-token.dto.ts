import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

/** Payload for creating a machine API token. */
export class CreateApiTokenDto {
  @ApiProperty({ description: 'Human-readable label', example: 'ci' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;
}

/** A created API token. The plaintext value is only returned once. */
export class CreatedApiTokenDto {
  @ApiProperty({ description: 'Token UUID' })
  id: string;

  @ApiProperty({ description: 'Plaintext token; shown only once' })
  token: string;

  @ApiProperty({ description: 'Display prefix' })
  prefix: string;

  @ApiProperty({ description: 'Label' })
  name: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}
