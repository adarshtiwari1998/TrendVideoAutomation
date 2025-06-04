
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Settings, 
  Key, 
  Youtube, 
  Mic, 
  Video, 
  Brain,
  CheckCircle,
  AlertCircle,
  Save
} from "lucide-react";

interface APIKey {
  name: string;
  key: string;
  status: 'connected' | 'disconnected' | 'unknown';
  icon: any;
  description: string;
  required: boolean;
}

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([
    {
      name: 'GEMINI_API_KEY',
      key: '',
      status: 'disconnected',
      icon: Brain,
      description: 'Google Gemini AI for content generation and Veo-2 video creation',
      required: true
    },
    {
      name: 'GOOGLE_APPLICATION_CREDENTIALS', 
      key: '',
      status: 'disconnected',
      icon: Mic,
      description: 'Google Cloud credentials for Text-to-Speech API',
      required: true
    },
    {
      name: 'GOOGLE_CLOUD_PROJECT_ID',
      key: '',
      status: 'disconnected', 
      icon: Video,
      description: 'Google Cloud Project ID for TTS services',
      required: true
    },
    {
      name: 'YOUTUBE_CHANNEL_ID',
      key: '',
      status: 'disconnected',
      icon: Youtube,
      description: 'Your YouTube channel for automated uploads',
      required: true
    }
  ]);

  const [channelName, setChannelName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleKeyChange = (index: number, value: string) => {
    const updated = [...apiKeys];
    updated[index].key = value;
    updated[index].status = value ? 'unknown' : 'disconnected';
    setApiKeys(updated);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Send API keys to backend
      const response = await fetch('/api/settings/update-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKeys: apiKeys.reduce((acc, key) => ({
            ...acc,
            [key.name]: key.key
          }), {}),
          channelName
        })
      });

      if (response.ok) {
        // Update status for keys that were saved
        const updated = apiKeys.map(key => ({
          ...key,
          status: key.key ? 'connected' as const : 'disconnected' as const
        }));
        setApiKeys(updated);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    setIsLoading(false);
  };

  const getChannelId = async () => {
    if (!channelName.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/youtube/channel-id?name=${encodeURIComponent(channelName)}`);
      if (response.ok) {
        const { channelId } = await response.json();
        const updated = [...apiKeys];
        const channelKeyIndex = updated.findIndex(k => k.name === 'YOUTUBE_CHANNEL_ID');
        if (channelKeyIndex >= 0) {
          updated[channelKeyIndex].key = channelId;
          updated[channelKeyIndex].status = 'connected';
          setApiKeys(updated);
        }
      }
    } catch (error) {
      console.error('Failed to get channel ID:', error);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Configure API keys and services for your YouTube automation system
          </p>
        </div>

        <div className="grid gap-6">
          {/* API Keys Section */}
          <Card className="bg-card border border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5" />
                <span>API Keys Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {apiKeys.map((apiKey, index) => (
                <div key={apiKey.name} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <apiKey.icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <Label className="text-sm font-medium">{apiKey.name}</Label>
                        <p className="text-xs text-muted-foreground">{apiKey.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {apiKey.required && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                      <Badge 
                        variant={apiKey.status === 'connected' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {apiKey.status === 'connected' ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        )}
                        {apiKey.status}
                      </Badge>
                    </div>
                  </div>
                  <Input
                    type="password"
                    placeholder={`Enter your ${apiKey.name}`}
                    value={apiKey.key}
                    onChange={(e) => handleKeyChange(index, e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* YouTube Channel Configuration */}
          <Card className="bg-card border border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Youtube className="h-5 w-5" />
                <span>YouTube Channel Setup</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Channel Name</Label>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter your YouTube channel name"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                  />
                  <Button 
                    onClick={getChannelId}
                    disabled={!channelName.trim() || isLoading}
                    variant="outline"
                  >
                    Get Channel ID
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your channel name to automatically extract the channel ID
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Configuration */}
          <div className="flex justify-end space-x-4">
            <Button 
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{isLoading ? 'Saving...' : 'Save Configuration'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
