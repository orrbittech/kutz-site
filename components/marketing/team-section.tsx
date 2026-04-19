import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { TeamMembersStrip } from '@/components/marketing/team-members-strip';
import { getTeamMembersPublic } from '@/lib/server/get-marketing-public';

export async function TeamSection(): Promise<React.JSX.Element> {
  const t = await getTranslations('home.team');
  const result = await getTeamMembersPublic();

  if (!result.ok) {
    return (
      <Card className="mx-auto mt-10 max-w-md border-red-200 bg-red-50 text-sm text-red-900">
        {t('loadError')} {t('errorUnknown')}
      </Card>
    );
  }

  const items = result.data;
  if (items.length === 0) {
    return (
      <Card className="mx-auto mt-10 max-w-md text-sm text-foreground/80">
        {t('empty')}
      </Card>
    );
  }

  return <TeamMembersStrip members={items} />;
}
