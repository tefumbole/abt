import {
  Settings,
  Shield,
  Warehouse,
  Users,
  Star,
  Ruler,
  Wallet,
  Percent,
  User,
  Mail,
  Gift,
  ShoppingCart,
  FileCode,
  ArrowLeftRight,
  Trash2,
  Clock,
  DatabaseBackup,
  Scale,
  Building2,
} from 'lucide-react';

/**
 * Beyond-style Settings hub tabs (order matches Beyond Tech General Setting screen).
 * `id` is used as ?tab= query value on /admin/general-settings
 */
export const SETTINGS_NAV_TABS = [
  { id: 'general', label: 'General Setting', icon: Settings, color: 'navy' },
  { id: 'roles', label: 'Role Permission', icon: Shield, color: 'gold' },
  { id: 'warehouses', label: 'Warehouse', icon: Warehouse, color: 'purple' },
  { id: 'customer-group', label: 'Customer Group', icon: Users, color: 'pink' },
  { id: 'brands', label: 'Brand', icon: Star, color: 'green' },
  { id: 'units', label: 'Unit', icon: Ruler, color: 'orange' },
  { id: 'currency', label: 'Currency', icon: Wallet, color: 'teal' },
  { id: 'tax', label: 'Tax', icon: Percent, color: 'rose' },
  { id: 'profile', label: 'User Profile', icon: User, color: 'gold' },
  { id: 'mail', label: 'Mail Setting', icon: Mail, color: 'indigo' },
  { id: 'reward', label: 'Reward Point Setting', icon: Gift, color: 'pink' },
  { id: 'pos', label: 'POS Settings', icon: ShoppingCart, color: 'green' },
  { id: 'env', label: '.env Settings', icon: FileCode, color: 'gold' },
  { id: 'transactions', label: 'My Transactions', icon: ArrowLeftRight, color: 'teal' },
  { id: 'empty-db', label: 'Empty Database', icon: Trash2, color: 'rose' },
  { id: 'logs', label: 'Activity Logs', icon: Clock, color: 'blue' },
  { id: 'backup', label: 'Backup Database', icon: DatabaseBackup, color: 'gold' },
  { id: 'billers', label: 'Billers', icon: Building2, color: 'cyan' },
  { id: 'license', label: 'License Agreement', icon: Scale, color: 'indigo' },
];

export const DEFAULT_SETTINGS_TAB = 'general';
