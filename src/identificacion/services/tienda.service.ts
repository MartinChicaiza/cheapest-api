import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateTiendaDto,
  QueryTiendaDto,
  TiendaResponseDto,
  UpdateTiendaDto,
} from '../dtos';
import { TiendaRepository } from '../repositories';
import { Tienda } from '../repositories/entities';

@Injectable()
export class TiendaService {
  constructor(private readonly tiendaRepository: TiendaRepository) {}

  async create(dto: CreateTiendaDto): Promise<TiendaResponseDto> {
    const tienda = await this.tiendaRepository.create(dto);
    return this.mapToResponse(tienda);
  }

  async findAll(query: QueryTiendaDto): Promise<TiendaResponseDto[]> {
    const tiendas = await this.tiendaRepository.findAll(query);
    return tiendas.map((tienda) => this.mapToResponse(tienda));
  }

  async findById(id: string): Promise<TiendaResponseDto> {
    const tienda = await this.tiendaRepository.findById(id);
    if (!tienda) {
      throw new NotFoundException(`Tienda con id ${id} no encontrada`);
    }
    return this.mapToResponse(tienda);
  }

  async update(id: string, dto: UpdateTiendaDto): Promise<TiendaResponseDto> {
    const tienda = await this.tiendaRepository.findById(id);
    if (!tienda) {
      throw new NotFoundException(`Tienda con id ${id} no encontrada`);
    }

    const updatedTienda = await this.tiendaRepository.update(id, dto);
    return this.mapToResponse(updatedTienda!);
  }

  async delete(id: string): Promise<void> {
    const tienda = await this.tiendaRepository.findById(id);
    if (!tienda) {
      throw new NotFoundException(`Tienda con id ${id} no encontrada`);
    }

    await this.tiendaRepository.delete(id);
  }

  /**
   * Verifica la existencia de una tienda. Mantiene la misma firma que el
   * antiguo TiendaClientMock.exists para que otros subdominios (logística)
   * puedan depender de este servicio sin cambiar su lógica.
   */
  async exists(tiendaId: string): Promise<boolean> {
    const tienda = await this.tiendaRepository.findById(tiendaId);
    return tienda !== null;
  }

  private mapToResponse(tienda: Tienda): TiendaResponseDto {
    return {
      id: tienda.id,
      codigoInterno: tienda.codigoInterno,
      nombre: tienda.nombre,
      direccion: tienda.direccion,
      zona: tienda.zona,
      rut: tienda.rut,
      createdAt: tienda.createdAt,
      updatedAt: tienda.updatedAt,
    };
  }
}
