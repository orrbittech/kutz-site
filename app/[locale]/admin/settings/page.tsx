import { AppChrome } from '@/components/app-chrome';
import { getSiteSettingsPublic } from '@/lib/server/get-site-settings';
import { AdminSettingsView } from './admin-settings-view';

export default async function AdminSettingsPage(): Promise<React.JSX.Element> {
  const initial = await getSiteSettingsPublic();
  return (
    <AppChrome>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 outline-none md:px-6"
      >
        <AdminSettingsView initial={initial} />
      </main>
    </AppChrome>
  );
}
