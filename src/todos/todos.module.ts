import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateTodoHandler } from './handlers/create-todo.handler';
import { DeleteTodoHandler } from './handlers/delete-todo.handler';
import { GetTodoHandler } from './handlers/get-todo.handler';
import { ListTodosHandler } from './handlers/list-todos.handler';
import { UpdateTodoHandler } from './handlers/update-todo.handler';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

const CommandHandlers = [CreateTodoHandler, UpdateTodoHandler, DeleteTodoHandler];
const QueryHandlers = [GetTodoHandler, ListTodosHandler];

@Module({
  imports: [CqrsModule],
  controllers: [TodosController],
  providers: [TodosService, ...CommandHandlers, ...QueryHandlers],
  exports: [TodosService],
})
export class TodosModule {}
