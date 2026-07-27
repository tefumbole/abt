import { CalendarDays, PlusCircle, Utensils, LineChart } from 'lucide-react';

export const EVENT_NAV = [
  { label: 'Event Manager', path: '/admin/events', icon: CalendarDays, color: 'navy' },
  { label: 'Create Event', path: '/admin/events/create', icon: PlusCircle, color: 'green' },
  { label: 'Meal List', path: '/admin/events/meals', icon: Utensils, color: 'orange' },
  { label: 'Create Meal', path: '/admin/events/meals/create', icon: PlusCircle, color: 'teal' },
  { label: 'Analytics', path: '/admin/events/analytics', icon: LineChart, color: 'purple' },
];
