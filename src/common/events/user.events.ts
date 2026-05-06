import type { User } from '../../database/schema';
import { DomainEvent } from './domain-event.base';

export class UserRegisteredEvent extends DomainEvent {
  readonly eventName = 'user.registered';
  constructor(public readonly user: User) {
    super();
  }
}

export class UserLoginEvent extends DomainEvent {
  readonly eventName = 'user.login';
  constructor(
    public readonly userId: string,
    public readonly ipAddress?: string,
  ) {
    super();
  }
}

export class UserEmailVerifiedEvent extends DomainEvent {
  readonly eventName = 'user.email_verified';
  constructor(public readonly userId: string) {
    super();
  }
}

export class UserPasswordResetEvent extends DomainEvent {
  readonly eventName = 'user.password_reset';
  constructor(public readonly userId: string) {
    super();
  }
}
