export default function TermsOfServicePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          Terms of Service
        </h1>
      </div>

      <div className="space-y-6 text-sm leading-7 text-zinc-700">
        <p>
          By using MoneyStage, you agree to these terms for event creation,
          discovery, and RSVP participation.
        </p>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            User responsibilities
          </h2>
          <p>
            You are responsible for the accuracy of event details, RSVP actions,
            and content you publish.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            Acceptable use
          </h2>
          <p>
            You must not use MoneyStage for unlawful, misleading, or abusive
            activities.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            Service availability
          </h2>
          <p>
            MoneyStage is provided on an as-is basis. We may update features and
            availability without prior notice.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            Contact
          </h2>
          <p>
            For legal or policy questions, contact the MoneyStage team through
            your official support channel.
          </p>
        </section>
      </div>
    </main>
  );
}
