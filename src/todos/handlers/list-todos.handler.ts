import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PaginatedResponse } from '../../common/dto/pagination.dto';
import type { Todo } from '../../database/schema';
import { ListTodosQuery } from '../queries/list-todos.query';
import { TodosService } from '../todos.service';

@QueryHandler(ListTodosQuery)
export class ListTodosHandler implements IQueryHandler<ListTodosQuery, PaginatedResponse<Todo>> {
  constructor(private readonly todosService: TodosService) {}

  execute(query: ListTodosQuery): Promise<PaginatedResponse<Todo>> {
    return this.todosService.findAll(query.userId, query.pagination);
  }
}
