import type { TodoQueryDto } from '../dto/todo-query.dto';

export class ListTodosQuery {
  constructor(
    public readonly userId: string,
    public readonly pagination: TodoQueryDto,
  ) {}
}
