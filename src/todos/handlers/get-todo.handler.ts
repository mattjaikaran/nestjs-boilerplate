import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Todo } from '../../database/schema';
import { GetTodoQuery } from '../queries/get-todo.query';
import { TodosService } from '../todos.service';

@QueryHandler(GetTodoQuery)
export class GetTodoHandler implements IQueryHandler<GetTodoQuery, Todo> {
  constructor(private readonly todosService: TodosService) {}

  execute(query: GetTodoQuery): Promise<Todo> {
    return this.todosService.findOne(query.id, query.userId);
  }
}
