import type { CreateTodoDto } from '../dto/create-todo.dto';

export class CreateTodoCommand {
  constructor(
    public readonly userId: string,
    public readonly dto: CreateTodoDto,
  ) {}
}
