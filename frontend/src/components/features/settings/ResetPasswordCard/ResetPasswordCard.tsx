import { useState } from "react";
import { Button, Card, message } from "antd";
import { useSession } from "@/components/providers/session-context";
import { api } from "@/api/client";

/**
 * Reset password card.
 *
 * Calls POST /auth/forgot-password. The backend generates a temporary
 * password and emails it (or returns it directly when no mailer is
 * configured).
 */
export function ResetPasswordCard() {
  const { user } = useSession();
  const [sending, setSending] = useState(false);

  if (!user) return null;

  const handleReset = async () => {
    setSending(true);
    try {
      await api.forgotPassword(user.email);
      message.success(`Reset link sent to ${user.email}`);
    } catch {
      message.error("Could not send reset link. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card title="Reset password">
      <p className="text-sm text-(--ant-color-text-secondary)">
        We'll send a reset link to{" "}
        <span className="font-medium text-(--ant-color-text)">
          {user.email}
        </span>
        .
      </p>

      <div className="mt-4 flex justify-end">
        <Button type="primary" loading={sending} onClick={handleReset}>
          Send reset link
        </Button>
      </div>
    </Card>
  );
}
