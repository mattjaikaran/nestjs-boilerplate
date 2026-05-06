import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TodoDeletedEvent } from '../../common/events/todo.events';
import { DeleteTodoCommand } from '../commands/delete-todo.command';
import { TodosService } from '../todos.service';

@CommandHandler(DeleteTodoCommand)
export class DeleteTodoHandler implements ICommandHandler<DeleteTodoCommand, void> {
  constructor(
    private readonly todosService: TodosService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: DeleteTodoCommand): Promise<void> {
    await this.todosService.remove(command.id, command.userId);
    this.eventEmitter.emit('todo.deleted', new TodoDeletedEvent(command.id, command.userId));
  }
}
