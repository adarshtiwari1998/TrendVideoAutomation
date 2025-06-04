import { Home, TrendingUp, Video, Clock, BarChart3, Cloud, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Trending Topics', href: '/trending-topics', icon: TrendingUp },
  { name: 'Video Pipeline', href: '/video-pipeline', icon: Video },
  { name: 'Scheduler', href: '/scheduler', icon: Clock },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Cloud Storage', href: '/cloud-storage', icon: Cloud },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const [location, setLocation] = useLocation();

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-card px-6 py-4 border-r border-border">
        <div className="flex h-16 shrink-0 items-center">
          <Video className="h-8 w-8 text-primary" />
          <span className="ml-2 text-xl font-bold text-foreground">YouTube AI</span>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <button
                      onClick={() => setLocation(item.href)}
                      className={cn(
                        location === item.href
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                        'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-colors duration-200 w-full text-left'
                      )}
                    >
                      <item.icon
                        className="h-6 w-6 shrink-0"
                        aria-hidden="true"
                      />
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}