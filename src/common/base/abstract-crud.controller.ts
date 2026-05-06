import { Body, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import type { PaginatedResponse, PaginationDto } from '../dto/pagination.dto';
import type { AbstractCrudService } from './abstract-crud.service';

/**
 * Abstract base controller wiring standard REST verbs to the AbstractCrudService.
 * Extend and call super() or override individual methods for custom behaviour.
 */
export abstract class AbstractCrudController<
  Entity,
  CreateDto,
  UpdateDto,
  FindAllQuery extends PaginationDto = PaginationDto,
> {
  constructor(
    protected readonly service: AbstractCrudService<Entity, CreateDto, UpdateDto, FindAllQuery>,
    protected readonly resourceName: string,
  ) {}

  @Get()
  @ApiOperation({ summary: `List ${String(null)}` })
  @ApiResponse({ status: 200, description: 'Paginated list' })
  findAll(@Query() query: FindAllQuery): Promise<PaginatedResponse<Entity>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  findOne(@Param('id') id: string): Promise<Entity> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateDto): Promise<Entity> {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200 })
  update(@Param('id') id: string, @Body() dto: UpdateDto): Promise<Entity> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204 })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
