import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TodoCompletedEvent } from '../../common/events/todo.events';
import type { Todo } from '../../database/schema';
import { UpdateTodoCommand } from '../commands/update-todo.command';
import { TodosService } from '../todos.service';

@CommandHandler(UpdateTodoCommand)
export class UpdateTodoHandler implements ICommandHandler<UpdateTodoCommand, Todo> {
  constructor(
    private readonly todosService: TodosService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: UpdateTodoCommand): Promise<Todo> {
    const previous = await this.todosService.findOne(command.id, command.userId);
    const updated = await this.todosService.update(command.id, command.userId, command.dto);

    if (!previous.isCompleted && updated.isCompleted) {
      this.eventEmitter.emit('todo.completed', new TodoCompletedEvent(updated.id, updated.userId));
    }

    return updated;
  }
}
