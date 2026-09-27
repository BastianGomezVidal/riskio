// src/auth/mailer.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

type Transport = 'log' | 'smtp';

/**
 * Delivers password reset links to users.
 *
 * Two modes, chosen explicitly through `MAIL_TRANSPORT`:
 *
 * - `smtp` sends for real. Missing connection details are rejected by the
 *   environment schema at boot, so a typo cannot surface later as a failed
 *   reset for one unlucky user.
 * - `log` writes the message to the backend log. Convenient locally, and
 *   deliberately noisy here: a reset link in a log file is a working
 *   credential for anyone who can read it, so this mode says so out loud
 *   instead of pretending the mail went out.
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private readonly mode: Transport;
  private readonly from: string;
  private readonly smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth?: { user: string; pass: string };
  };
  private transporter: Transporter | null = null;

  constructor(config: ConfigService) {
    this.mode = config.get<Transport>('MAIL_TRANSPORT', 'log');
    this.from = config.get<string>('MAIL_FROM', 'riskio@example.com');

    const host = config.get<string>('SMTP_HOST', '');
    const user = config.get<string>('SMTP_USER', '');
    const pass = config.get<string>('SMTP_PASS', '');

    this.smtp = {
      host,
      port: config.get<number>('SMTP_PORT', 587),
      secure: config.get<boolean>('SMTP_SECURE', false),
      ...(user && pass ? { auth: { user, pass } } : {}),
    };
  }

  onModuleInit(): void {
    if (this.mode === 'log') {
      this.logger.warn(
        'MAIL_TRANSPORT=log: password reset links are NOT being sent, they go to this log. ' +
          'Set MAIL_TRANSPORT=smtp with SMTP_* before running this anywhere real.',
      );
      return;
    }

    this.transporter = createTransport(this.smtp);
    this.logger.log(`Mailer ready: smtp://${this.smtp.host}:${this.smtp.port}`);
  }

  /**
   * Send a password reset link.
   *
   * Throws when the transport fails. Callers must not let that change an HTTP
   * response: a delivery failure that produced a different status than a
   * success would turn a broken SMTP into an oracle for which addresses have an
   * account.
   */
  async sendPasswordResetLink(to: string, link: string): Promise<void> {
    if (this.mode === 'log' || !this.transporter) {
      this.logger.warn(
        `[MAIL] not sent (MAIL_TRANSPORT=log). Password reset link for ${to}: ${link}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Reset your Riskio password',
      text: [
        'Someone asked to reset the password for this account.',
        '',
        `Open this link to choose a new one: ${link}`,
        '',
        'The link works once and expires in 30 minutes. If this was not you,',
        'ignore this message: nothing has changed.',
      ].join('\n'),
    });

    this.logger.log(`[MAIL] reset link sent to ${to}`);
  }
}
