export type UserRole = 'admin' | 'user' | 'moderator';
export type AuthProvider = 'local' | 'google' | 'github';
export type OtpType = 'email_verification' | 'password_reset' | 'magic_link' | 'two_factor';
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TodoPriority = 'low' | 'medium' | 'high';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface JwtTokenPair {
  accessToken: string;
  refreshToken: string;
}

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
