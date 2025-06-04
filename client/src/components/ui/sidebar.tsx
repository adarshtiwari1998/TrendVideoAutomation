import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  Video, 
  Calendar,
  Settings,
  Cloud,
  User,
  Youtube
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const navigation = [
    { name: 'Dashboard', icon: BarChart3, current: true },
    { name: 'Trending Topics', icon: TrendingUp, current: false },
    { name: 'Video Pipeline', icon: Video, current: false },
    { name: 'Scheduler', icon: Calendar, current: false },
    { name: 'Analytics', icon: BarChart3, current: false },
    { name: 'Cloud Storage', icon: Cloud, current: false },
    { name: 'Settings', icon: Settings, current: false },
  ];

  return (
    <aside className={cn("w-64 bg-card shadow-lg flex flex-col border-r border-border", className)}>
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center">
            <Youtube className="text-primary-foreground w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">YT Studio</h1>
            <p className="text-sm text-muted-foreground">Automation Hub</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <a
                href="#"
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  item.current
                    ? "text-primary-foreground bg-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Content Creator</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
