import { UserOutlined } from "@ant-design/icons";
import { Avatar } from "antd";

interface UserAvatarProps {
  src: string | null;
  size?: number;
  alt?: string;
}

export function UserAvatar({
  src,
  size = 32,
  alt = "Image of User",
}: UserAvatarProps) {
  if (src) {
    return (
      <Avatar size={size} src={src} alt={alt}>
        <UserOutlined />
      </Avatar>
    );
  }

  return <Avatar size={size} icon={<UserOutlined />} alt={alt} />;
}
