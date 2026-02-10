import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRequestQueue } from '@/hooks/useRequestQueue';
import { Loader2, Activity, Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { QueueItemSnapshot } from '@/utils/requestQueue';

const QueueRealtimePage: React.FC = () => {
  const {
    queueLength,
    activeCount,
    isProcessing,
    completedCount,
    failedCount,
    activeItems,
    pendingItems,
    recentlyCompleted,
  } = useRequestQueue();

  const getStatusColor = (status: QueueItemSnapshot['status']) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const getStatusIcon = (status: QueueItemSnapshot['status']) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Request Queue - Realtime Monitor</h1>
        <p className="text-muted-foreground">
          ติดตามการทำงานของ Request Queue แบบ Real-time
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              🔄 Active Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{activeCount}</span>
              <span className="text-sm text-muted-foreground">/ 8 max</span>
            </div>
            {isProcessing && (
              <Badge variant="outline" className="mt-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Processing
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ⏳ Queued
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{queueLength}</span>
              <span className="text-sm text-muted-foreground">waiting</span>
            </div>
            {queueLength > 10 && (
              <Badge variant="outline" className="mt-2 bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
                High Queue
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ✅ Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-green-600">{completedCount}</span>
              <span className="text-sm text-muted-foreground">total</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ❌ Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-red-600">{failedCount}</span>
              <span className="text-sm text-muted-foreground">errors</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Queue Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queueLength === 0 && activeCount === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No requests in queue</p>
              <p className="text-sm">Queue is empty and ready</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Processing Requests */}
              {activeCount > 0 && (
                <div>
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing ({activeCount})
                  </div>
                  <div className="space-y-2">
                    {activeItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border ${getStatusColor(item.status)} flex items-center justify-between`}
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(item.status)}
                          <div>
                            <div className="font-medium text-sm">{item.type}</div>
                            <div className="text-xs opacity-75">
                              Duration: {item.duration ? `${(item.duration / 1000).toFixed(1)}s` : '0s'}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-card">
                          #{item.id.slice(-6)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Requests */}
              {queueLength > 0 && (
                <div>
                  <div className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Waiting ({queueLength})
                  </div>
                  <div className="space-y-2">
                    {pendingItems.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border ${getStatusColor(item.status)} flex items-center justify-between`}
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(item.status)}
                          <div>
                            <div className="font-medium text-sm">{item.type}</div>
                            <div className="text-xs opacity-75">Queued</div>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-card">
                          #{item.id.slice(-6)}
                        </Badge>
                      </div>
                    ))}
                    {queueLength > 10 && (
                      <div className="text-center text-sm text-muted-foreground py-2">
                        ... และอีก {queueLength - 10} รายการ
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="mt-6 bg-muted">
        <CardHeader>
          <CardTitle className="text-lg">ข้อมูลระบบ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max Concurrent Requests:</span>
            <span className="font-medium">8</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Active:</span>
            <span className="font-medium">{activeCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Available Slots:</span>
            <span className="font-medium text-green-600">{8 - activeCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Queue Length:</span>
            <span className="font-medium">{queueLength}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={isProcessing ? "default" : "secondary"}>
              {isProcessing ? 'Active' : 'Idle'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QueueRealtimePage;
