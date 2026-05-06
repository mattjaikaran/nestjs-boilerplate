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
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PaginationDto } from '../common/dto/pagination.dto';
import {
  ErrorResponseDto,
  PaginatedTodosResponseDto,
  TodoResponseDto,
} from '../common/dto/swagger.dto';
import { CreateTodoCommand } from './commands/create-todo.command';
import { DeleteTodoCommand } from './commands/delete-todo.command';
import { UpdateTodoCommand } from './commands/update-todo.command';
import type { CreateTodoDto } from './dto/create-todo.dto';
import type { UpdateTodoDto } from './dto/update-todo.dto';
import { GetTodoQuery } from './queries/get-todo.query';
import { ListTodosQuery } from './queries/list-todos.query';
import { TodosService } from './todos.service';

@ApiTags('Todos')
@ApiBearerAuth()
@Controller('todos')
export class TodosController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly todosService: TodosService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a todo' })
  @ApiResponse({ status: 201, description: 'Todo created', type: TodoResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTodoDto) {
    return this.commandBus.execute(new CreateTodoCommand(userId, dto));
  }

  @Get()
  @ApiOperation({ summary: 'List todos with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of todos',
    type: PaginatedTodosResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  findAll(@CurrentUser('id') userId: string, @Query() query: PaginationDto) {
    return this.queryBus.execute(new ListTodosQuery(userId, query));
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get todo statistics' })
  @ApiResponse({ status: 200, description: 'Todo counts by status' })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  stats(@CurrentUser('id') userId: string) {
    return this.todosService.stats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a todo by ID' })
  @ApiResponse({ status: 200, description: 'Todo found', type: TodoResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Todo not found', type: ErrorResponseDto })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetTodoQuery(id, userId));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a todo' })
  @ApiResponse({ status: 200, description: 'Todo updated', type: TodoResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Todo not found', type: ErrorResponseDto })
  update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: UpdateTodoDto) {
    return this.commandBus.execute(new UpdateTodoCommand(id, userId, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a todo' })
  @ApiResponse({ status: 204, description: 'Todo deleted' })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Todo not found', type: ErrorResponseDto })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.commandBus.execute(new DeleteTodoCommand(id, userId));
  }
}
