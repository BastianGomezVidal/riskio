import { GoogleOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { oauthAuthorizeUrl } from "@/api/client";

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="1" width="6.5" height="6.5" />
      <rect x="8.5" y="1" width="6.5" height="6.5" />
      <rect x="1" y="8.5" width="6.5" height="6.5" />
      <rect x="8.5" y="8.5" width="6.5" height="6.5" />
    </svg>
  );
}

export function ExternalAuth() {
  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
      <Button className="flex-1" icon={<GoogleOutlined />} href={oauthAuthorizeUrl("google")}>
        Google
      </Button>
      <Button className="flex-1" icon={<MicrosoftIcon />} href={oauthAuthorizeUrl("outlook")}>
        Outlook
      </Button>
    </div>
  );
}