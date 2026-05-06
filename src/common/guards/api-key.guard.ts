import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from '../../auth/api-key.service';
import { UsersService } from '../../users/users.service';
import { API_KEY_HEADER, REQUIRE_API_KEY } from '../decorators/api-key.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private apiKeyService: ApiKeyService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireApiKey = this.reflector.getAllAndOverride<boolean>(REQUIRE_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requireApiKey) return true;

    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers[API_KEY_HEADER] as string | undefined;

    if (!rawKey) throw new UnauthorizedException('API key required');

    const apiKey = await this.apiKeyService.validate(rawKey);
    if (!apiKey) throw new UnauthorizedException('Invalid or expired API key');

    const user = await this.usersService.findById(apiKey.userId);
    if (!user || !user.isActive) throw new UnauthorizedException('Account disabled');

    request.user = user;
    request.apiKey = apiKey;

    return true;
  }
}
