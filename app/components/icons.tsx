import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChartColumnIncreasing,
  CircleCheck,
  Clock,
  House,
  Menu,
  MessageCircle,
  Send,
  UserRound,
  UsersRound,
} from "lucide-react";

const icons = {
  pulse: Activity,
  home: House,
  chart: ChartColumnIncreasing,
  book: BookOpen,
  chat: MessageCircle,
  arrow: ArrowRight,
  back: ArrowLeft,
  user: UserRound,
  users: UsersRound,
  check: CircleCheck,
  clock: Clock,
  menu: Menu,
  send: Send,
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
