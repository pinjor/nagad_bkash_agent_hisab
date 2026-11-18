import { createFileRoute } from '@tanstack/react-router';
import { People as PeoplePage } from '@/features/people/People';
export const Route = createFileRoute('/people')({ head: () => ({ meta: [{ title: 'খাতা — আমার হিসাব' }, { name: 'description', content: 'ধার দেওয়া ও নেওয়া, ফেরতের সময়সহ।' }, { property: 'og:title', content: 'খাতা — আমার হিসাব' }, { property: 'og:description', content: 'মানুষের ধারের হিসাব।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: People });
function People() { return <PeoplePage />; }
