import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { FEATURE_FLAG_KEY } from './feature-flags.decorator';
import { FeatureFlagsService } from './feature-flags.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!flagKey) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id as string | undefined;

    const enabled = await this.featureFlagsService.isEnabled(flagKey, userId);
    if (!enabled) {
      throw new AppException(
        ErrorCode.FEATURE_DISABLED,
        `Feature '${flagKey}' is not enabled`,
        403,
      );
    }
    return true;
  }
}
