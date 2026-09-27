import { useEffect, useState } from "react";
import { Button, Input, Modal, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useDeleteMe } from "@/data/queries.hooks";

interface Props {
  open: boolean;
  onClose: () => void;
}

const CONFIRM_WORD = "DELETE";

export function DeleteAccountModal({ open, onClose }: Props) {
  const [text, setText] = useState("");
  const navigate = useNavigate();
  // The hook clears the cached profile and signs out on success, so this
  // component only has to report and navigate.
  const deleteMe = useDeleteMe();
  const deleting = deleteMe.isPending;

  // Reset input when opening.
  useEffect(() => {
    if (open) setText("");
  }, [open]);

  const canConfirm = text === CONFIRM_WORD && !deleting;

  const handleConfirm = async () => {
    try {
      await deleteMe.mutateAsync();
      message.success("Account deleted");
      navigate("/", { replace: true });
    } catch {
      message.error("Could not delete account. Try again.");
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
