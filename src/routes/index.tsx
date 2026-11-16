import { createFileRoute } from '@tanstack/react-router';
import { Home } from '@/features/home/Home';
export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'আজকের হিসাব — আমার হিসাব' }, { name: 'description', content: 'হাতে নগদ ও সব পকেটের টাকা এক নজরে। আপনার বাংলা দোকানের হিসাব, আপনার ফোনে।' }, { property: 'og:title', content: 'আজকের হিসাব — আমার হিসাব' }, { property: 'og:description', content: 'সব পকেটের টাকা ও শুরুর হিসাব এক নজরে।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Home,
});
