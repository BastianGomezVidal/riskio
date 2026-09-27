import { Input } from "antd";

export interface ProfileFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface Props {
  form: ProfileFormState;
  onChange: (next: ProfileFormState) => void;
}

export function ProfileFields({ form, onChange }: Props) {
  const update = <K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="First name">
        <Input
          value={form.firstName}
          onChange={(e) => update("firstName", e.target.value)}
          placeholder="Juan Sebastián"
        />
      </Field>

      <Field label="Last name">
        <Input
          value={form.lastName}
          onChange={(e) => update("lastName", e.target.value)}
          placeholder="Gómez"
        />
      </Field>

      <Field label="Email">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="user@example.com"
        />
      </Field>

      <Field label="Phone">
        <Input
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="+1 555 010 1234"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-(--ant-color-text-secondary)">
        {label}
      </span>
      {children}
    </label>
  );
}
