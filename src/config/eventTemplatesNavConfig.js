import { FileText, MessageSquare, Settings } from 'lucide-react';

export const EVENT_TEMPLATES_NAV = [
  { label: 'Design Templates', path: '/admin/events/templates', icon: FileText, color: 'navy' },
  { label: 'WhatsApp Templates', path: '/admin/events/wa-templates', icon: MessageSquare, color: 'green' },
  { label: 'Webhook Settings', path: '/admin/events/webhooks', icon: Settings, color: 'slate' },
];
