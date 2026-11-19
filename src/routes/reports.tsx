import { createFileRoute } from '@tanstack/react-router';
import { Reports as ReportsPage } from '@/features/reports/Reports';
export const Route = createFileRoute('/reports')({
  validateSearch: (search: Record<string, unknown>) => ({
    pocket: typeof search.pocket === 'string' ? search.pocket : '',
    kind: typeof search.kind === 'string' ? search.kind : '',
    range: search.range === 'today' || search.range === '7' || search.range === '30' || search.range === 'all' ? search.range : '',
  }),
  head: () => ({ meta: [{ title: 'রিপোর্ট — আমার হিসাব' }, { name: 'description', content: 'মালিক পুরো রিপোর্ট দেখেন। কর্মচারী আগের হিসাব দেখেন।' }, { property: 'og:title', content: 'রিপোর্ট — আমার হিসাব' }, { property: 'og:description', content: 'আপনার দোকানের প্রতিদিনের টাকার রিপোর্ট।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Reports,
});
function Reports() {
  const search = Route.useSearch();
  return <ReportsPage initial={search} />;
}
