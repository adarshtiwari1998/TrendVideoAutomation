
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Loader2, Play, Pause } from 'lucide-react';

export default function SchedulerPage() {
  const queryClient = useQueryClient();

  const { data: schedulerStatus, isLoading } = useQuery({
    queryKey: ['scheduler-status'],
    queryFn: async () => {
      const response = await fetch('/api/automation/status');
      if (!response.ok) throw new Error('Failed to fetch scheduler status');
      return response.json();
    },
    refetchInterval: 10000
  });

  const triggerDailyAutomation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/automation/trigger-daily', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to trigger automation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-status'] });
    }
  });

  const triggerUploadCheck = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/uploads/check', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to check uploads');
      return response.json();
    }
  });

  const scheduleItems = [
    {
      name: 'Trending Analysis',
      schedule: '6:00 AM IST Daily',
      description: 'Analyze trending topics from multiple sources',
      status: 'active'
    },
    {
      name: 'Daily Content Creation',
      schedule: '9:00 AM IST Daily',
      description: 'Create 1 long-form video + 1 short video',
      status: 'active'
    },
    {
      name: 'Upload Check',
      schedule: 'Every 30 minutes',
      description: 'Check for scheduled uploads and publish',
      status: 'active'
    },
    {
      name: 'Storage Cleanup',
      schedule: 'Sundays 2:00 AM IST',
      description: 'Clean up old files and optimize storage',
      status: 'active'
    },
    {
      name: 'Health Check',
      schedule: 'Every hour',
      description: 'Monitor system health and connectivity',
      status: 'active'
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Automation Scheduler</h1>
      </div>

      {/* Manual Triggers */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Manual Triggers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={() => triggerDailyAutomation.mutate()}
              disabled={triggerDailyAutomation.isPending}
              className="flex items-center gap-2"
            >
              {triggerDailyAutomation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Trigger Daily Automation
            </Button>
            <Button
              variant="outline"
              onClick={() => triggerUploadCheck.mutate()}
              disabled={triggerUploadCheck.isPending}
              className="flex items-center gap-2"
            >
              {triggerUploadCheck.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              Check Scheduled Uploads
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {scheduleItems.map((item, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{item.schedule}</span>
                    </div>
                  </div>
                  <Badge 
                    className={item.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}
                  >
                    {item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
