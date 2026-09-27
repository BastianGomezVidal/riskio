import { useRef } from "react";
import { Button, message } from "antd";
import { UserAvatar } from "../UserAvatar/UserAvatar";
import { useUploadAvatar } from "@/data/queries.hooks";
import type { User } from "@/domain/users";

interface Props {
  user: User;
}

export function ProfileHeader({ user }: Props) {
  const uploadAvatar = useUploadAvatar();
  const inputRef = useRef<HTMLInputElement>(null);

  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadAvatar.mutateAsync(file);
      message.success("Avatar updated");
    } catch {
      message.error("Could not upload avatar. Try again.");
    } finally {
      // Reset so the same file can be picked again.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <UserAvatar src={user.avatarUrl} size={72} alt={fullName} />
      <div className="min-w-0 flex-1">
        <div className="text-lg font-semibold">{fullName}</div>
        <div className="truncate text-sm text-(--ant-color-text-secondary)">
          {user.email}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          size="small"
          className="mt-2"
          loading={uploadAvatar.isPending}
          onClick={() => inputRef.current?.click()}
        >
          Change photo
        </Button>
      </div>
    </div>
  );
}
