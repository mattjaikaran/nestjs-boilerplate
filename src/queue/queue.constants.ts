export const EMAIL_QUEUE = 'email';

export const EMAIL_JOBS = {
  SEND_VERIFICATION: 'send_verification',
  SEND_PASSWORD_RESET: 'send_password_reset',
  SEND_MAGIC_LINK: 'send_magic_link',
  SEND_GENERIC: 'send_generic',
  SEND_NOTIFICATION: 'send_notification',
} as const;

export type EmailJobName = (typeof EMAIL_JOBS)[keyof typeof EMAIL_JOBS];
