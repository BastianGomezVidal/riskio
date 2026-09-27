import { useEffect, useState } from "react";
import { Button, Input, Modal, message } from "antd";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useSession } from "@/auth/session-context";

interface Props {
  open: boolean;
  onClose: () => void;
}

const CONFIRM_WORD = "DELETE";

export function DeleteAccountModal({ open, onClose }: Props) {
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useSession();

  // Reset input when opening.
  useEffect(() => {
    if (open) setText("");
  }, [open]);

  const canConfirm = text === CONFIRM_WORD && !deleting;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await api.deleteMe();
      signOut();
      message.success("Account deleted");
      navigate("/", { replace: true });
    } catch {
      message.error("Could not delete account. Try again.");
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Delete account"
      footer={null}
      destroyOnHidden
      maskClosable={!deleting}
      closable={!deleting}
    >
      <p className="text-sm">
        This action is <strong>irreversible</strong>. All your data will be
        permanently deleted.
      </p>

      <p className="mt-4 text-sm">
        To confirm, type{" "}
        <code className="rounded bg-(--ant-color-fill-quaternary) px-1 font-mono">
          {CONFIRM_WORD}
        </code>{" "}
        in the field below:
      </p>

      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={CONFIRM_WORD}
        className="mt-2"
        autoFocus
        disabled={deleting}
      />

      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          danger
          disabled={!canConfirm}
          loading={deleting}
          onClick={handleConfirm}
        >
          Delete account
        </Button>
      </div>
    </Modal>
  );
}
