import { NotFoundException } from '@nestjs/common';
import type { PaginatedResponse, PaginationDto } from '../dto/pagination.dto';

/**
 * Abstract base service providing generic CRUD contract.
 * Concrete services extend this and implement the abstract methods against their
 * specific data store (Drizzle table, external API, etc.).
 */
export abstract class AbstractCrudService<
  Entity,
  CreateDto,
  UpdateDto,
  FindAllQuery extends PaginationDto = PaginationDto,
> {
  abstract create(dto: CreateDto, context?: Record<string, unknown>): Promise<Entity>;
  abstract findAll(
    query: FindAllQuery,
    context?: Record<string, unknown>,
  ): Promise<PaginatedResponse<Entity>>;
  abstract findOne(id: string, context?: Record<string, unknown>): Promise<Entity>;
  abstract update(id: string, dto: UpdateDto, context?: Record<string, unknown>): Promise<Entity>;
  abstract remove(id: string, context?: Record<string, unknown>): Promise<void>;

  protected notFound(resource: string, id: string): never {
    throw new NotFoundException(`${resource} with id '${id}' not found`);
  }
}
