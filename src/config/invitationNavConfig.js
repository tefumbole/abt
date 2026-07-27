import { PlusCircle, ListTodo, QrCode } from 'lucide-react';

export const INVITATION_NAV = [
  { label: 'Create Invitation', path: '/admin/invitations/create', icon: PlusCircle, color: 'green' },
  { label: 'All Invitations', path: '/admin/invitations', icon: ListTodo, color: 'navy' },
  { label: 'QR Check-In', path: '/admin/check-in', icon: QrCode, color: 'purple' },
];
