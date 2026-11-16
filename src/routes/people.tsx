import { createFileRoute } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { FuturePage } from '@/features/foundations/FuturePage';
export const Route = createFileRoute('/people')({ head: () => ({ meta: [{ title: 'খাতা — আমার হিসাব' }, { name: 'description', content: 'বাকি ও জমার বাংলা খাতা ধাপ ৩-এ আসবে।' }, { property: 'og:title', content: 'খাতা — আমার হিসাব' }, { property: 'og:description', content: 'মানুষের বাকি ও আমানতের হিসাব।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: People });
function People() { return <FuturePage title="খাতা" phase="ধাপ ৩-এ বাকি ও জমার খাতা" icon={Users} />; }
