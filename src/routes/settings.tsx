import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '@/features/settings/Settings';
export const Route = createFileRoute('/settings')({ head: () => ({ meta: [{ title: 'সেটিংস — আমার হিসাব' }, { name: 'description', content: 'দোকানের নাম, পিন, বাংলা সংখ্যা, গোপনীয়তা ও ফোনের স্টোরেজ।' }, { property: 'og:title', content: 'সেটিংস — আমার হিসাব' }, { property: 'og:description', content: 'আপনার হিসাব আপনার মতো সাজান।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: SettingsPage });
