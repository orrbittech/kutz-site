import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/card';

export default function LocaleNotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 py-16">
      <Card className="max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
        <p className="text-sm text-foreground/75">
          This page does not exist or was moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-brand-white shadow-sm hover:bg-brand-orange"
        >
          Back home
        </Link>
      </Card>
    </div>
  );
}
