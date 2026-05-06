import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TodoCompletedEvent, TodoCreatedEvent, TodoDeletedEvent } from './todo.events';
import {
  UserEmailVerifiedEvent,
  UserLoginEvent,
  UserPasswordResetEvent,
  UserRegisteredEvent,
} from './user.events';

/**
 * Central domain event listener — pluggable side-effects without coupling emitters to consumers.
 * Add @OnEvent handlers here or in feature-specific listeners.
 */
@Injectable()
export class DomainEventListener {
  private readonly logger = new Logger(DomainEventListener.name);

  @OnEvent('user.registered', { async: true })
  onUserRegistered(event: UserRegisteredEvent): void {
    this.logger.log(`New user registered: ${event.user.email}`);
  }

  @OnEvent('user.login', { async: true })
  onUserLogin(event: UserLoginEvent): void {
    this.logger.debug(`User ${event.userId} logged in from ${event.ipAddress ?? 'unknown'}`);
  }

  @OnEvent('user.email_verified', { async: true })
  onEmailVerified(event: UserEmailVerifiedEvent): void {
    this.logger.log(`Email verified for user ${event.userId}`);
  }

  @OnEvent('user.password_reset', { async: true })
  onPasswordReset(event: UserPasswordResetEvent): void {
    this.logger.log(`Password reset for user ${event.userId}`);
  }

  @OnEvent('todo.created', { async: true })
  onTodoCreated(event: TodoCreatedEvent): void {
    this.logger.debug(`Todo created: ${event.todo.id} by user ${event.todo.userId}`);
  }

  @OnEvent('todo.completed', { async: true })
  onTodoCompleted(event: TodoCompletedEvent): void {
    this.logger.log(`Todo ${event.todoId} marked complete by user ${event.userId}`);
  }

  @OnEvent('todo.deleted', { async: true })
  onTodoDeleted(event: TodoDeletedEvent): void {
    this.logger.debug(`Todo ${event.todoId} deleted by user ${event.userId}`);
  }
}
