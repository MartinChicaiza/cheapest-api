import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTiendaDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  codigoInterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  zona?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  rut?: string;
}
