import { useEffect, useState } from "react";
import { Button, Card, message } from "antd";
import { useUpdateMe } from "@/data/queries.hooks";
import { useSession } from "@/auth/session-context";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileFields } from "./ProfileFields";
import { ProfileReadOnly } from "./ProfileReadOnly";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

/**
 * Profile card: identity header, editable fields, read-only fields.
 *
 * On Save, calls PATCH /users/me and syncs the session context with the
 * returned profile. Email is shown read-only until the dedicated change
 * flow (with verification) lands.
 */
export function ProfileCard() {
  const { user } = useSession();
  const updateMe = useUpdateMe();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<FormState>(EMPTY_FORM);

  const profile: FormState = {
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
  };

  // The session boots from JWT claims, where firstName and lastName are empty
  // strings, and the real profile lands a tick later. Seeding the form only on
  // the first render left it holding the stub, so every save sent an empty
  // firstName and the API answered 400 — the form could not be saved at all.
  // Re-seeding when the profile actually changes fixes that, and does not
  // disturb in-progress edits: typing updates `form`, not `user`.
  useEffect(() => {
    setForm(profile);
    setBaseline(profile);
  }, [profile.firstName, profile.lastName, profile.email, profile.phone]);

  if (!user) return null;

  const hasChanges =
    form.firstName !== baseline.firstName ||
    form.lastName !== baseline.lastName ||
    form.phone !== baseline.phone;

  const onSave = async () => {
    try {
      const updated = await updateMe.mutateAsync({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      });
      setBaseline({ ...form, email: updated.email });
      message.success("Profile updated");
    } catch {
      message.error("Could not update profile. Try again.");
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
        <Button onClick={onCancel} disabled={!hasChanges || updateMe.isPending}>
          Cancel
        </Button>
        <Button
          type="primary"
          onClick={onSave}
          disabled={!hasChanges}
          loading={updateMe.isPending}
        >
          Save
        </Button>
      </div>
    </Card>
  );
}
