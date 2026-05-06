import type { UpdateTodoDto } from '../dto/update-todo.dto';

export class UpdateTodoCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly dto: UpdateTodoDto,
  ) {}
}
