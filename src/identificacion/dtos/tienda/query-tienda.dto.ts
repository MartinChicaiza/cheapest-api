import { IsOptional, IsString } from 'class-validator';

export class QueryTiendaDto {
  @IsOptional()
  @IsString()
  codigoInterno?: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  zona?: string;
}
