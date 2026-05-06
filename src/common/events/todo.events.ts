import type { Todo } from '../../database/schema';
import { DomainEvent } from './domain-event.base';

export class TodoCreatedEvent extends DomainEvent {
  readonly eventName = 'todo.created';
  constructor(public readonly todo: Todo) {
    super();
  }
}

export class TodoCompletedEvent extends DomainEvent {
  readonly eventName = 'todo.completed';
  constructor(
    public readonly todoId: string,
    public readonly userId: string,
  ) {
    super();
  }
}

export class TodoDeletedEvent extends DomainEvent {
  readonly eventName = 'todo.deleted';
  constructor(
    public readonly todoId: string,
    public readonly userId: string,
  ) {
    super();
  }
}
