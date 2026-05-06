import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TodoCreatedEvent } from '../../common/events/todo.events';
import type { Todo } from '../../database/schema';
import { CreateTodoCommand } from '../commands/create-todo.command';
import { TodosService } from '../todos.service';

@CommandHandler(CreateTodoCommand)
export class CreateTodoHandler implements ICommandHandler<CreateTodoCommand, Todo> {
  constructor(
    private readonly todosService: TodosService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: CreateTodoCommand): Promise<Todo> {
    const todo = await this.todosService.create(command.userId, command.dto);
    this.eventEmitter.emit('todo.created', new TodoCreatedEvent(todo));
    return todo;
  }
}
