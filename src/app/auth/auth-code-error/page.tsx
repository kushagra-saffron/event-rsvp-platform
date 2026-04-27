import Link from "next/link";

type Props = {
  searchParams: Promise<{ message?: string }>;
};

export default async function AuthCodeErrorPage({ searchParams }: Props) {
  const { message } = await searchParams;
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-zinc-900">
          Sign-in could not be completed
        </h1>
        {message ? (
          <p className="mt-2 text-sm text-zinc-600">{message}</p>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">
            The auth callback did not return a valid session. Check Supabase
            redirect URLs and Google OAuth settings.
          </p>
        )}
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-indigo-600"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
