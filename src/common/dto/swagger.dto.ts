import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'VALIDATION_FAILED' })
  errorCode: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/auth/register' })
  path: string;

  @ApiProperty({ example: 'POST' })
  method: string;

  @ApiProperty({ example: 'Validation failed' })
  message: unknown;
}

export class UserResponseDto {
  @ApiProperty({ example: 'uuid-v4' })
  id: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'user', enum: ['admin', 'user', 'moderator'] })
  role: string;

  @ApiProperty({ example: false })
  isEmailVerified: boolean;

  @ApiProperty({ example: false })
  isTotpEnabled: boolean;

  @ApiProperty({ example: null, nullable: true })
  avatarUrl: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class AuthTokensResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiJ9...' })
  refreshToken: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class TodoResponseDto {
  @ApiProperty({ example: 'uuid-v4' })
  id: string;

  @ApiProperty({ example: 'Buy groceries' })
  title: string;

  @ApiProperty({ example: 'Milk, eggs, bread', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'pending', enum: ['pending', 'in_progress', 'completed', 'archived'] })
  status: string;

  @ApiProperty({ example: 'medium', enum: ['low', 'medium', 'high', 'urgent'] })
  priority: string;

  @ApiProperty({ example: false })
  isCompleted: boolean;

  @ApiProperty({ example: ['groceries'], type: [String] })
  tags: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CheckoutSessionResponseDto {
  @ApiProperty({ example: 'https://checkout.stripe.com/...' })
  url: string;
}

export class PortalSessionResponseDto {
  @ApiProperty({ example: 'https://billing.stripe.com/...' })
  url: string;
}

export class SubscriptionResponseDto {
  @ApiProperty({ example: 'uuid-v4', nullable: true })
  id: string | null;

  @ApiProperty({ example: 'uuid-v4' })
  userId: string;

  @ApiProperty({ example: 'cus_xxx' })
  stripeCustomerId: string;

  @ApiProperty({ example: 'sub_xxx' })
  stripeSubscriptionId: string;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'trialing', 'past_due', 'canceled', 'unpaid'],
  })
  status: string;

  @ApiProperty()
  currentPeriodStart: Date;

  @ApiProperty()
  currentPeriodEnd: Date;
}

export class PaymentHistoryItemDto {
  @ApiProperty({ example: 'uuid-v4' })
  id: string;

  @ApiProperty({ example: 'uuid-v4' })
  userId: string;

  @ApiProperty({ example: 1999 })
  amount: number;

  @ApiProperty({ example: 'usd' })
  currency: string;

  @ApiProperty({ example: 'succeeded', enum: ['succeeded', 'failed', 'pending'] })
  status: string;

  @ApiProperty()
  createdAt: Date;
}

export class UploadedFileResponseDto {
  @ApiProperty({ example: 'a1b2c3d4.jpg' })
  filename: string;

  @ApiProperty({ example: 'photo.jpg' })
  originalName: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType: string;

  @ApiProperty({ example: 204800 })
  size: number;

  @ApiProperty({ example: 'http://localhost:3000/api/v1/uploads/avatars/a1b2c3d4.jpg' })
  url: string;

  @ApiProperty({ example: 'uploads/avatars/a1b2c3d4.jpg' })
  path: string;
}

export class WebhookReceivedResponseDto {
  @ApiProperty({ example: true })
  received: boolean;
}

export class PaginatedTodosResponseDto {
  @ApiProperty({ type: [TodoResponseDto] })
  data: TodoResponseDto[];

  @ApiProperty()
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
