import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PaginationDto } from '../common/dto/pagination.dto';
import type { CreateTodoDto } from './dto/create-todo.dto';
import type { UpdateTodoDto } from './dto/update-todo.dto';
import { TodosService } from './todos.service';

@ApiTags('Todos')
@ApiBearerAuth()
@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Post()
  @ApiOperation({ summary: 'Create a todo' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTodoDto) {
    return this.todosService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List todos with pagination' })
  findAll(@CurrentUser('id') userId: string, @Query() query: PaginationDto) {
    return this.todosService.findAll(userId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get todo statistics' })
  stats(@CurrentUser('id') userId: string) {
    return this.todosService.stats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a todo by ID' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.todosService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a todo' })
  update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: UpdateTodoDto) {
    return this.todosService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a todo' })
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.todosService.remove(id, userId);
  }
}
