import { createFileRoute } from '@tanstack/react-router';
import { ChartNoAxesCombined } from 'lucide-react';
import { FuturePage } from '@/features/foundations/FuturePage';
export const Route = createFileRoute('/reports')({ head: () => ({ meta: [{ title: 'রিপোর্ট — আমার হিসাব' }, { name: 'description', content: 'দোকানের বিক্রি, লাভ ও দিন শেষের রিপোর্ট ধাপ ৫-এ আসবে।' }, { property: 'og:title', content: 'রিপোর্ট — আমার হিসাব' }, { property: 'og:description', content: 'আপনার দোকানের প্রতিদিনের টাকার রিপোর্ট।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Reports });
function Reports() { return <FuturePage title="রিপোর্ট" phase="ধাপ ৫-এ রিপোর্ট" icon={ChartNoAxesCombined} />; }
