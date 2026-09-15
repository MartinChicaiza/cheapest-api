import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTiendaDto {
  @IsString()
  @MaxLength(100)
  codigoInterno: string;

  @IsString()
  @MaxLength(255)
  nombre: string;

  @IsString()
  @MaxLength(255)
  direccion: string;

  @IsString()
  @MaxLength(255)
  zona: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  rut?: string;
}
