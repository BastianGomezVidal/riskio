import { useState } from "react";
import { Button, Card, message } from "antd";
import { useSession } from "@/auth/session-context";
import { api } from "@/api/client";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileFields } from "./ProfileFields";
import { ProfileReadOnly } from "./ProfileReadOnly";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/**
 * Profile card: identity header, editable fields, read-only fields.
 *
 * On Save, calls PATCH /users/me and syncs the session context with the
 * returned profile. Email is shown read-only until the dedicated change
 * flow (with verification) lands.
 */
export function ProfileCard() {
  const { user, updateUser } = useSession();

  if (!user) return null;

  const initial: FormState = {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone ?? "",
  };

  const [form, setForm] = useState<FormState>(initial);
  const [baseline, setBaseline] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  const hasChanges =
    form.firstName !== baseline.firstName ||
    form.lastName !== baseline.lastName ||
    form.phone !== baseline.phone;

  const onSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateMe({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      });
      updateUser(updated);
      setBaseline({ ...form, email: updated.email });
      message.success("Profile updated");
    } catch {
      message.error("Could not update profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    setForm(baseline);
  };

  return (
    <Card title="Profile">
      <ProfileHeader user={user} />
      <div className="mt-6">
        <ProfileFields form={form} onChange={setForm} />
      </div>
      <ProfileReadOnly user={user} />
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel} disabled={!hasChanges || saving}>
          Cancel
        </Button>
        <Button
          type="primary"
          onClick={onSave}
          disabled={!hasChanges}
          loading={saving}
        >
          Save
        </Button>
      </div>
    </Card>
  );
}
