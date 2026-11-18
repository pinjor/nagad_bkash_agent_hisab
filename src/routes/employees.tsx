import { createFileRoute } from '@tanstack/react-router';
import { EmployeesPage } from '@/features/employees/Employees';
export const Route = createFileRoute('/employees')({ head: () => ({ meta: [{ title: 'কর্মচারী — আমার হিসাব' }, { name: 'description', content: 'কর্মচারী যোগ, পিন, আর তাদের কাজের হিসাব। মালিক দেখেন।' }, { property: 'og:title', content: 'কর্মচারী — আমার হিসাব' }, { property: 'og:description', content: 'দোকানের কর্মচারী আর তাদের হিসাব।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: EmployeesPage });
