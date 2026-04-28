import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          Privacy Policy
        </h1>
        <Link href="/" className="text-sm font-medium text-indigo-600">
          Back to MoneyStage
        </Link>
      </div>

      <div className="space-y-6 text-sm leading-7 text-zinc-700">
        <p>
          MoneyStage collects only the data required to provide event discovery,
          RSVP, and hosting capabilities.
        </p>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            What we collect
          </h2>
          <p>
            We store profile details from Google sign-in, events you create, and
            RSVP activity.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            How we use data
          </h2>
          <p>
            Data is used to authenticate users, display event information,
            calculate RSVP counts, and personalize dashboard views.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            Data sharing
          </h2>
          <p>
            We do not sell personal data. Limited profile information can be shown
            to other users as part of event attendance visibility.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            Contact
          </h2>
          <p>
            For privacy requests, contact the MoneyStage team through your official
            support channel.
          </p>
        </section>
      </div>
    </main>
  );
}
