
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cloud, FolderOpen, HardDrive } from 'lucide-react';

export default function CloudStoragePage() {
  const { data: storageInfo } = useQuery({
    queryKey: ['storage-info'],
    queryFn: async () => {
      // Mock data for now
      return {
        totalUsed: '15.2 GB',
        totalAvailable: '100 GB',
        usagePercent: 15,
        folders: [
          { name: '2025-06-04', files: 12, size: '2.3 GB' },
          { name: '2025-06-03', files: 8, size: '1.8 GB' },
          { name: '2025-06-02', files: 10, size: '2.1 GB' }
        ]
      };
    }
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <Cloud className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Cloud Storage</h1>
      </div>

      {/* Storage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Used Storage</p>
                <p className="text-2xl font-bold">{storageInfo?.totalUsed || '0 GB'}</p>
              </div>
              <HardDrive className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-2xl font-bold">{storageInfo?.totalAvailable || '0 GB'}</p>
              </div>
              <Cloud className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usage</p>
                <p className="text-2xl font-bold">{storageInfo?.usagePercent || 0}%</p>
              </div>
              <FolderOpen className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Folder Structure */}
      <Card>
        <CardHeader>
          <CardTitle>Date-wise Folders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {storageInfo?.folders?.map((folder, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-5 w-5 text-blue-500" />
                    <div>
                      <h3 className="font-medium">{folder.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {folder.files} files • {folder.size}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Open in Drive
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
