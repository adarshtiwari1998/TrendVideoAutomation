import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from '@/pages/dashboard';
import Settings from '@/pages/settings';
import NotFound from '@/pages/not-found';
import TrendingTopicsPage from '@/pages/trending-topics';
import VideoPipelinePage from '@/pages/video-pipeline';
import SchedulerPage from '@/pages/scheduler';
import AnalyticsPage from '@/pages/analytics';
import CloudStoragePage from '@/pages/cloud-storage';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
       <Route path="/trending-topics" component={TrendingTopicsPage} />
          <Route path="/video-pipeline" component={VideoPipelinePage} />
          <Route path="/scheduler" component={SchedulerPage} />
          <Route path="/analytics" component={AnalyticsPage} />
          <Route path="/cloud-storage" component={CloudStoragePage} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;