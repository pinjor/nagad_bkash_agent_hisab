import { createFileRoute } from '@tanstack/react-router';
import { Reports as ReportsPage } from '@/features/reports/Reports';
export const Route = createFileRoute('/reports')({ head: () => ({ meta: [{ title: 'রিপোর্ট — আমার হিসাব' }, { name: 'description', content: 'আজকের টাকা ও ধারের ফেরত। মালিক দেখেন।' }, { property: 'og:title', content: 'রিপোর্ট — আমার হিসাব' }, { property: 'og:description', content: 'আপনার দোকানের প্রতিদিনের টাকার রিপোর্ট।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Reports });
function Reports() { return <ReportsPage />; }
