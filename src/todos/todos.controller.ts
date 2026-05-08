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
import {
  ErrorResponseDto,
  PaginatedTodosResponseDto,
  TodoResponseDto,
} from '../common/dto/swagger.dto';
import { CreateTodoCommand } from './commands/create-todo.command';
import { DeleteTodoCommand } from './commands/delete-todo.command';
import { UpdateTodoCommand } from './commands/update-todo.command';
import type { CreateTodoDto } from './dto/create-todo.dto';
import { TodoQueryDto } from './dto/todo-query.dto';
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
  @ApiOperation({ summary: 'List todos with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of todos',
    type: PaginatedTodosResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  findAll(@CurrentUser('id') userId: string, @Query() query: TodoQueryDto) {
    return this.queryBus.execute(new ListTodosQuery(userId, query));
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get todo statistics' })
  @ApiResponse({ status: 200, description: 'Todo counts by status, priority, and overdue' })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  stats(@CurrentUser('id') userId: string) {
    return this.todosService.stats(userId);
  }

  // POST /todos/bulk-delete — rsbuild shape
  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk delete todos by IDs (POST)' })
  @ApiResponse({
    status: 200,
    description: 'Todos deleted',
    schema: { example: { deletedCount: 3 } },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  bulkDeletePost(@CurrentUser('id') userId: string, @Body() body: { ids: string[] }) {
    return this.todosService.bulkDelete(userId, body.ids);
  }

  // DELETE /todos/bulk — react-vite shape (body: { ids })
  @Delete('bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk delete todos by IDs (DELETE)' })
  @ApiResponse({
    status: 200,
    description: 'Todos deleted',
    schema: { example: { deletedCount: 3 } },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  bulkDeleteDelete(@CurrentUser('id') userId: string, @Body() body: { ids: string[] }) {
    return this.todosService.bulkDelete(userId, body.ids);
  }

  @Post('archive-completed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive all completed todos (soft delete)' })
  @ApiResponse({ status: 200, description: 'Completed todos archived' })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  archiveCompleted(@CurrentUser('id') userId: string) {
    return this.todosService.archiveCompleted(userId);
  }

  // PATCH /todos/bulk — handles both body shapes:
  //   rsbuild: { ids, ...updates }
  //   react-vite: { ids, updates: { ... } }
  @Patch('bulk')
  @ApiOperation({ summary: 'Bulk update todos by IDs' })
  @ApiResponse({ status: 200, description: 'Todos updated', type: [TodoResponseDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  bulkUpdate(
    @CurrentUser('id') userId: string,
    @Body() body: { ids: string[]; updates?: UpdateTodoDto } & UpdateTodoDto,
  ) {
    const { ids, updates, ...rest } = body;
    return this.todosService.bulkUpdate(userId, ids, (updates ?? rest) as UpdateTodoDto);
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

  // POST /todos/:id/toggle — rsbuild shape
  @Post(':id/toggle')
  @ApiOperation({ summary: 'Toggle todo completion (POST)' })
  @ApiResponse({ status: 200, description: 'Todo toggled', type: TodoResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Todo not found', type: ErrorResponseDto })
  togglePost(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.todosService.toggle(id, userId);
  }

  // PATCH /todos/:id/toggle — react-vite shape
  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle todo completion (PATCH)' })
  @ApiResponse({ status: 200, description: 'Todo toggled', type: TodoResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Todo not found', type: ErrorResponseDto })
  togglePatch(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.todosService.toggle(id, userId);
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
