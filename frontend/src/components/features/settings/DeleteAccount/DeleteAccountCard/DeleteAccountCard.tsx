import { useState } from "react";
import { Button, Card } from "antd";
import { DeleteAccountModal } from "../DeleteAccountModal/DeleteAccountModal";

/**
 * Delete account card.
 *
 * Phase 6: opens a confirmation modal. Phase 7 will wire the confirm
 * action to DELETE /users/me.
 */
export function DeleteAccountCard() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Card
        title="Delete account"
        className="border-red-200"
        styles={{
          header: { borderBottomColor: "rgb(254 202 202)" },
        }}
      >
        <p className="text-sm text-(--ant-color-text-secondary)">
          This will permanently delete your account and all associated data.
          This action cannot be undone.
        </p>

        <div className="mt-4 flex justify-end">
          <Button danger onClick={() => setModalOpen(true)}>
            Delete account
          </Button>
        </div>
      </Card>

      <DeleteAccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
