// src/auth/mailer.service.ts
import { Injectable, Logger } from '@nestjs/common';

/**
 * Delivers temporary passwords to users.
 *
 * Development implementation: logs to the backend console so the developer
 * can pick up the password locally. Swap in a real mailer (nodemailer,
 * SendGrid, Resend...) for production.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendTemporaryPassword(to: string, password: string): Promise<void> {
    this.logger.log(`[MAIL] to=${to} temporaryPassword=${password}`);
  }
}
