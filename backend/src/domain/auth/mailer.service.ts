// src/auth/mailer.service.ts
import { Injectable, Logger } from '@nestjs/common';

/**
 * Delivers password reset links to users.
 *
 * Development implementation: writes to the backend console so the link can be
 * followed locally. Swap in a real transport (nodemailer, Resend, SES) for
 * production — the interface is one method precisely so that substitution is
 * the only change needed.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendPasswordResetLink(to: string, link: string): Promise<void> {
    this.logger.warn(
      `[MAIL] no transport configured. Password reset link for ${to}: ${link}`,
    );
  }
}
