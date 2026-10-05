import { DeleteAccountCard } from "../DeleteAccount/DeleteAccountCard/DeleteAccountCard";
import { ProfileCard } from "../ProfileCard/ProfileCard";
import { ResetPasswordCard } from "../ResetPasswordCard/ResetPasswordCard";

/**
 * Settings page content: three cards stacked vertically.
 *
 * Each card is wrapped in a section with an `id` so that hash links
 * from the user menu (e.g. `/settings#reset-password`) can scroll and
 * focus the right card.
 *
 * There is no API tokens section. The only consumer of a machine token is
 * `POST /admin/ingest/*`, a manual ingestion trigger that the scheduler
 * covers on its own, and the frontend never called it. What the section
 * actually provided was a settings page where any account could mint a
 * long-lived machine credential for an API that has no use for it. The
 * `/auth/tokens` endpoints still exist for scripts; they are just not
 * reachable from the UI.
 */
export function SettingsContent() {
  return (
    <div className="space-y-6">
      <section
        id="profile"
        tabIndex={-1}
        className="scroll-mt-20 focus:outline-none"
      >
        <ProfileCard />
      </section>

      <section
        id="reset-password"
        tabIndex={-1}
        className="scroll-mt-20 focus:outline-none"
      >
        <ResetPasswordCard />
      </section>

      <section
        id="delete-account"
        tabIndex={-1}
        className="scroll-mt-20 focus:outline-none"
      >
        <DeleteAccountCard />
      </section>
    </div>
  );
}
