import { SetMetadata } from '@nestjs/common';

export const API_KEY_HEADER = 'x-api-key';
export const REQUIRE_API_KEY = 'requireApiKey';
export const RequireApiKey = () => SetMetadata(REQUIRE_API_KEY, true);
