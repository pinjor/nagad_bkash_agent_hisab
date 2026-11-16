import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { FuturePage } from '@/features/foundations/FuturePage';
export const Route = createFileRoute('/entry')({ head: () => ({ meta: [{ title: 'নতুন হিসাব — আমার হিসাব' }, { name: 'description', content: 'দোকানের নতুন লেনদেন। ক্যাশ ইন, ক্যাশ আউট ও ফ্লেক্সিলোড ধাপ ২-এ আসবে।' }, { property: 'og:title', content: 'নতুন হিসাব — আমার হিসাব' }, { property: 'og:description', content: 'দোকানের নতুন লেনদেনের খাতা।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Entry });
function Entry() { return <FuturePage title="নতুন হিসাব" phase="ধাপ ২-এ নতুন লেনদেন" icon={Plus} />; }
