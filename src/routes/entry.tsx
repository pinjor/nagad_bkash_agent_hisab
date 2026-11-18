import { createFileRoute } from '@tanstack/react-router';
import { Entry } from '@/features/entry/Entry';
export const Route = createFileRoute('/entry')({ head: () => ({ meta: [{ title: 'নতুন হিসাব — আমার হিসাব' }, { name: 'description', content: 'ক্যাশ ইন, ক্যাশ আউট ও ফ্লেক্সিলোড। অফলাইনে ফোনে থাকে, অনলাইনে সার্ভারে যায়।' }, { property: 'og:title', content: 'নতুন হিসাব — আমার হিসাব' }, { property: 'og:description', content: 'দোকানের নতুন লেনদেনের খাতা।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: EntryPage });
function EntryPage() { return <Entry />; }
