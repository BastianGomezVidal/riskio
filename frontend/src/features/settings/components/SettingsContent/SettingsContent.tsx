import { DeleteAccountCard } from "../DeleteAccount/DeleteAccountCard/DeleteAccountCard";
import { ProfileCard } from "../ProfileCard/ProfileCard";
import { ResetPasswordCard } from "../ResetPasswordCard/ResetPasswordCard";

/**
 * Settings page content: three cards stacked vertically.
 *
 * Each card is wrapped in a section with an `id` so that hash links
 * from the user menu (e.g. `/settings#reset-password`) can scroll and
 * focus the right card.
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
