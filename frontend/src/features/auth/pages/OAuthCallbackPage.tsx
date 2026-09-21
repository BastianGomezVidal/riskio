import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/auth/session-context";
import { storeAccessToken } from "@/auth/session";

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { restoreFromStoredToken } = useSession();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const error = params.get("error");

    if (token) {
      storeAccessToken(token);
      restoreFromStoredToken();
      navigate("/dashboard", { replace: true });
      return;
    }

    const reason = error ?? "oauth_failed";
    setMessage(`Sign-in failed: ${reason}`);
    navigate(`/?error=${reason}`, { replace: true });
  }, [navigate, restoreFromStoredToken]);

  return (
    <main className="login">
      <h1>Riskio</h1>
      <p>{message}</p>
    </main>
  );
}
