
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Youtube, Plus, Settings2 } from 'lucide-react';

export default function YouTubeSettingsPage() {
  const [channelName, setChannelName] = useState('');
  const queryClient = useQueryClient();

  const { data: channels } = useQuery({
    queryKey: ['youtube-channels'],
    queryFn: async () => {
      const response = await fetch('/api/channels');
      if (!response.ok) throw new Error('Failed to fetch channels');
      return response.json();
    }
  });

  const addChannelMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: name })
      });
      if (!response.ok) throw new Error('Failed to add channel');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-channels'] });
      setChannelName('');
    }
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <Youtube className="h-6 w-6" />
        <h1 className="text-2xl font-bold">YouTube Settings</h1>
      </div>

      {/* Add Channel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add YouTube Channel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="channelName">Channel Name</Label>
              <Input
                id="channelName"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="Enter your YouTube channel name"
              />
            </div>
            <Button
              onClick={() => addChannelMutation.mutate(channelName)}
              disabled={!channelName || addChannelMutation.isPending}
            >
              Add Channel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Channels */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Channels</CardTitle>
        </CardHeader>
        <CardContent>
          {channels?.length > 0 ? (
            <div className="space-y-4">
              {channels.map((channel: any) => (
                <div key={channel.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{channel.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {channel.subscriberCount} subscribers
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Settings2 className="h-4 w-4 mr-2" />
                      Configure
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No channels connected</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
