import { IsEmail, IsString, MinLength } from 'class-validator';

export class BootstrapDto {
  @IsString()
  setupKey!: string;

  @IsString()
  @MinLength(2)
  organizationName!: string;

  @IsString()
  @MinLength(2)
  organizationCode!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
