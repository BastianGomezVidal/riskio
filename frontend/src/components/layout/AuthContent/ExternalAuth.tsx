import { oauthAuthorizeUrl } from "@/api/client";
import { ActionLink } from "@/components/shared/controls";

/**
 * Drawn inline rather than imported from `@ant-design/icons`.
 *
 * That package is matched by the `manualChunks` rule in `vite.config.ts`, so a
 * single icon import on the sign-in page made the browser fetch the whole
 * `vendor-antd` chunk: 177 KiB of gzip to draw one 16px glyph, on the page
 * whose only job is to appear fast. `MicrosoftIcon` below is already local for
 * the same reason.
 *
 * These four fills are Google's brand colours. They are deliberately not design
 * tokens: brand marks are fixed by their owner's guidelines, and re-theming them
 * to match the palette would misrepresent whose logo this is.
 */
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

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
      {/*
        `ActionLink` rather than an anchor wrapped around an `ActionButton`.
        Nesting them put two focusable elements under one label, so Tab stopped
        twice on each provider; the anchor here is the control and is styled like
        the button beside it.
      */}
      <ActionLink
        href={oauthAuthorizeUrl("google")}
        className="flex-1"
        icon={<GoogleIcon />}
        aria-label="Continue with Google"
      >
        Google
      </ActionLink>
      <ActionLink
        href={oauthAuthorizeUrl("outlook")}
        className="flex-1"
        icon={<MicrosoftIcon />}
        aria-label="Continue with Outlook"
      >
        Outlook
      </ActionLink>
    </div>
  );
}
