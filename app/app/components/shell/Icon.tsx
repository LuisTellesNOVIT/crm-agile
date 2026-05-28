import {
  LayoutDashboard,
  Inbox,
  Kanban,
  BarChart3,
  User,
  Users,
  MessageSquare,
  FileText,
  Zap,
  Database,
  Code,
  ChevronDown,
  ChevronRight,
  Check,
  Plus,
  Search,
  Settings,
  Command,
  Filter,
  Sparkles,
  TrendingUp,
  DollarSign,
  Clock,
  AlertTriangle,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  X,
  Mail,
  Eye,
  Phone,
  StickyNote,
  Calendar,
  MoreHorizontal,
  MessageCircle,
  type LucideProps,
} from "lucide-react";
import type { ComponentType, CSSProperties } from "react";

export type IconName =
  | "dashboard"
  | "inbox"
  | "kanban"
  | "gantt"
  | "user"
  | "users"
  | "chat"
  | "template"
  | "zap"
  | "database"
  | "code"
  | "chevron-down"
  | "chevron-right"
  | "check"
  | "plus"
  | "search"
  | "settings"
  | "command"
  | "filter"
  | "sparkles"
  | "trending"
  | "dollar"
  | "clock"
  | "alert"
  | "external"
  | "arrow-up"
  | "arrow-down"
  | "arrow-right"
  | "x"
  | "mail"
  | "eye"
  | "phone"
  | "doc"
  | "note"
  | "calendar"
  | "more"
  | "wa";

const MAP: Record<IconName, ComponentType<LucideProps>> = {
  dashboard: LayoutDashboard,
  inbox: Inbox,
  kanban: Kanban,
  gantt: BarChart3,
  user: User,
  users: Users,
  chat: MessageSquare,
  template: FileText,
  zap: Zap,
  database: Database,
  code: Code,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  check: Check,
  plus: Plus,
  search: Search,
  settings: Settings,
  command: Command,
  filter: Filter,
  sparkles: Sparkles,
  trending: TrendingUp,
  dollar: DollarSign,
  clock: Clock,
  alert: AlertTriangle,
  external: ExternalLink,
  "arrow-up": ArrowUp,
  "arrow-down": ArrowDown,
  "arrow-right": ArrowRight,
  x: X,
  mail: Mail,
  eye: Eye,
  phone: Phone,
  doc: FileText,
  note: StickyNote,
  calendar: Calendar,
  more: MoreHorizontal,
  wa: MessageCircle,
};

type Props = {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

export function Icon({ name, size = 14, className, style }: Props) {
  const Cmp = MAP[name];
  return <Cmp size={size} className={className} style={style} strokeWidth={1.75} />;
}
