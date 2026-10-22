import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChartColumnIncreasing,
  Check,
  ChevronDown,
  CircleCheck,
  Clock,
  History,
  House,
  ListTodo,
  Menu,
  MessageCircle,
  Play,
  RotateCw,
  Send,
  Search,
  Sparkle,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

const icons = {
  pulse: Activity,
  home: House,
  chart: ChartColumnIncreasing,
  book: BookOpen,
  assignment: ListTodo,
  journal: History,
  resume: Play,
  chat: MessageCircle,
  arrow: ArrowRight,
  back: ArrowLeft,
  user: UserRound,
  users: UsersRound,
  check: CircleCheck,
  tick: Check,
  chevron: ChevronDown,
  clock: Clock,
  menu: Menu,
  send: Send,
  search: Search,
  refresh: RotateCw,
  spark: Sparkle,
  close: X,
};

export function Icon({
  name,
  className = "",
}: {
  name: keyof typeof icons;
  className?: string;
}) {
  const LucideIcon = icons[name];

  return (
    <LucideIcon
      aria-hidden="true"
      focusable="false"
      className={`lp-icon ${className}`}
      size={20}
      strokeWidth={2}
    />
  );
}
