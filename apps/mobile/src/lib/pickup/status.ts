export type PickupRole = 'requester' | 'collector';

export interface StatusConfig {
  label: string;
  containerClass: string;
  dotClass: string;
  textClass: string;
}

export const ACTIVE_STATUSES = new Set([
  'pending',
  'accepted',
  'in_progress',
  'awaiting_confirmation',
]);

export function isStatusActive(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function getStatusLabel(status: string, role: PickupRole = 'requester'): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'accepted':
      return role === 'requester' ? 'Assigned' : 'Claimed';
    case 'in_progress':
      return 'In Progress';
    case 'awaiting_confirmation':
      return 'Review';
    case 'confirmed':
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'disputed':
    case 'not_collected':
      return 'Disputed';
    default:
      return status ? status.replaceAll('_', ' ') : 'Unknown';
  }
}

export function getStatusConfig(status: string, role: PickupRole = 'requester'): StatusConfig {
  const label = getStatusLabel(status, role);

  switch (status) {
    case 'pending':
      return {
        label,
        containerClass: 'bg-amber-500/10 border-amber-500/25',
        dotClass: 'bg-amber-500',
        textClass: 'text-amber-800 dark:text-amber-300',
      };
    case 'accepted':
      return {
        label,
        containerClass: 'bg-blue-500/10 border-blue-500/25',
        dotClass: 'bg-blue-500',
        textClass: 'text-blue-700 dark:text-blue-300',
      };
    case 'in_progress':
      return {
        label,
        containerClass: 'bg-blue-500/10 border-blue-500/25',
        dotClass: 'bg-blue-500',
        textClass: 'text-blue-700 dark:text-blue-300',
      };
    case 'awaiting_confirmation':
      return {
        label,
        containerClass: 'bg-amber-500/10 border-amber-500/25',
        dotClass: 'bg-amber-500',
        textClass: 'text-amber-800 dark:text-amber-300',
      };
    case 'confirmed':
    case 'completed':
      return {
        label,
        containerClass: 'bg-emerald-500/10 border-emerald-500/25',
        dotClass: 'bg-emerald-500',
        textClass: 'text-emerald-800 dark:text-emerald-300',
      };
    case 'cancelled':
      return {
        label,
        containerClass: 'bg-zinc-500/10 border-zinc-500/20',
        dotClass: 'bg-zinc-400',
        textClass: 'text-zinc-600 dark:text-zinc-400',
      };
    case 'disputed':
    case 'not_collected':
      return {
        label,
        containerClass: 'bg-rose-500/10 border-rose-500/25',
        dotClass: 'bg-rose-500',
        textClass: 'text-rose-800 dark:text-rose-300',
      };
    default:
      return {
        label,
        containerClass: 'bg-secondary/60 border-border/80',
        dotClass: 'bg-muted-foreground',
        textClass: 'text-muted-foreground',
      };
  }
}

