import { useEffect, useState } from "react";
import { Modal } from "antd";

interface Props {
  open: boolean;
  /** Seconds remaining before auto-logout. */
  secondsLeft: number;
  onStay: () => void;
}

/**
 * Warning modal shown `warningMs` before the idle timeout fires.
 * Displays a countdown and a button to extend the session.
 */
export function SessionExpiryModal({ open, secondsLeft, onStay }: Props) {
  const [prevFocus, setPrevFocus] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      setPrevFocus(document.activeElement as HTMLElement);
    } else if (prevFocus) {
      prevFocus.focus?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      open={open}
      title="Session expiring soon"
      okText="Stay signed in"
      onOk={onStay}
      onCancel={onStay}
      maskClosable={false}
      keyboard={false}
      closable={false}
      cancelButtonProps={{ style: { display: "none" } }}
    >
      <p>
        You have been inactive for a while. You will be signed out in{" "}
        <strong>{secondsLeft}</strong> second{secondsLeft === 1 ? "" : "s"}.
      </p>
      <p className="mt-2 text-sm text-(--ant-color-text-secondary)">
        Click <em>Stay signed in</em> to continue where you left off.
      </p>
    </Modal>
  );
}
