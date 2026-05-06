import { Module } from '@nestjs/common';
import { ApiKeyService } from '../auth/api-key.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ApiKeyService],
  exports: [UsersService],
})
export class UsersModule {}
