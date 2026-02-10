import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Filter, Clock, AlertCircle, FileText, CheckCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'document' | 'approval' | 'system' | 'reminder';
  priority: 'high' | 'medium' | 'low';
  read: boolean;
  timestamp: Date;
  actionUrl?: string;
}

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'เอกสารรออนุมัติ',
      message: 'บันทึกข้อความ เรื่อง การประชุมประจำเดือน รออนุมัติจากผู้อำนวยการ',
      type: 'approval',
      priority: 'high',
      read: false,
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
      actionUrl: '/approve-document/1'
    },
    {
      id: '2',
      title: 'เอกสารใหม่เข้าระบบ',
      message: 'มีเอกสารใหม่ถูกส่งเข้าระบบโดย นายสมศักดิ์ ใจดี',
      type: 'document',
      priority: 'medium',
      read: false,
      timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      actionUrl: '/documents'
    },
    {
      id: '3',
      title: 'เอกสารได้รับการอนุมัติ',
      message: 'บันทึกข้อความ เรื่อง การขอวัสดุอุปกรณ์ได้รับการอนุมัติแล้ว',
      type: 'approval',
      priority: 'low',
      read: true,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    },
    {
      id: '4',
      title: 'แจ้งเตือนระบบ',
      message: 'ระบบจะมีการปรับปรุงในวันที่ 25 มกราคม 2568 เวลา 02:00-04:00 น.',
      type: 'system',
      priority: 'medium',
      read: false,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
    }
  ]);

  const [activeTab, setActiveTab] = useState('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'approval':
        return <CheckCircle className="h-5 w-5 text-orange-500" />;
      case 'document':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'system':
        return <AlertCircle className="h-5 w-5 text-purple-500" />;
      case 'reminder':
        return <Clock className="h-5 w-5 text-green-500" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'low':
        return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'เมื่อสักครู่';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} นาทีที่แล้ว`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(diffInSeconds / 86400)} วันที่แล้ว`;
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
    toast({
      title: "อ่านแล้ว",
      description: "ทำเครื่องหมายการแจ้งเตือนว่าอ่านแล้ว",
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
    toast({
      title: "อ่านทั้งหมดแล้ว",
      description: "ทำเครื่องหมายการแจ้งเตือนทั้งหมดว่าอ่านแล้ว",
    });
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
    toast({
      title: "ลบแล้ว",
      description: "ลบการแจ้งเตือนแล้ว",
    });
  };

  const filteredNotifications = notifications.filter(notif => {
    if (activeTab === 'unread' && notif.read) return false;
    if (activeTab === 'read' && !notif.read) return false;
    if (filterPriority !== 'all' && notif.priority !== filterPriority) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background pt-20 pb-24 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardContent className="bg-rose-500 rounded-t-lg pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-rose-100" />
                <div>
                  <h1 className="text-xl font-bold text-white">การแจ้งเตือน</h1>
                  <p className="text-sm text-rose-100">
                    {unreadCount > 0 ? `มีการแจ้งเตือนใหม่ ${unreadCount} รายการ` : 'ไม่มีการแจ้งเตือนใหม่'}
                  </p>
                </div>
              </div>
              
              {unreadCount > 0 && (
                <Button 
                  onClick={markAllAsRead}
                  variant="outline"
                  size="sm"
                >
                  <Check className="h-4 w-4 mr-1" />
                  อ่านทั้งหมด
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-primary">{notifications.length}</div>
              <div className="text-xs text-muted-foreground">ทั้งหมด</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-amber-500">{unreadCount}</div>
              <div className="text-xs text-muted-foreground">ยังไม่อ่าน</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-red-500">
                {notifications.filter(n => n.priority === 'high' && !n.read).length}
              </div>
              <div className="text-xs text-muted-foreground">ลำดับสูง</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-blue-500">
                {notifications.filter(n => n.type === 'approval').length}
              </div>
              <div className="text-xs text-muted-foreground">รออนุมัติ</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Tabs */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                  <TabsTrigger value="unread" className="relative">
                    ยังไม่อ่าน
                    {unreadCount > 0 && (
                      <Badge className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5">
                        {unreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="read">อ่านแล้ว</TabsTrigger>
                </TabsList>

                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <select 
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="text-sm border border-border rounded-lg px-3 py-1 bg-background"
                  >
                    <option value="all">ทุกลำดับความสำคัญ</option>
                    <option value="high">ลำดับสูง</option>
                    <option value="medium">ลำดับกลาง</option>
                    <option value="low">ลำดับต่ำ</option>
                  </select>
                </div>
              </div>

              <TabsContent value={activeTab} className="mt-0">
                <div className="space-y-4">
                  {filteredNotifications.length === 0 ? (
                    <div className="text-center py-12">
                      <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">
                        ไม่มีการแจ้งเตือน
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {activeTab === 'unread' ? 'ไม่มีการแจ้งเตือนที่ยังไม่ได้อ่าน' : 'ไม่มีการแจ้งเตือนในหมวดหมู่นี้'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredNotifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          className={`p-4 rounded-lg border transition-colors ${
                            notification.read 
                              ? 'bg-muted/50 border-border' 
                              : 'bg-card border-primary/20'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 pt-0.5">
                              {getNotificationIcon(notification.type)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <h3 className={`font-medium ${
                                    notification.read ? 'text-muted-foreground' : 'text-foreground'
                                  }`}>
                                    {notification.title}
                                  </h3>
                                  <Badge className={getPriorityColor(notification.priority)}>
                                    {notification.priority === 'high' && 'ลำดับสูง'}
                                    {notification.priority === 'medium' && 'ลำดับกลาง'}
                                    {notification.priority === 'low' && 'ลำดับต่ำ'}
                                  </Badge>
                                  {!notification.read && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimeAgo(notification.timestamp)}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteNotification(notification.id)}
                                    className="p-1 h-6 w-6 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              
                              <p className={`text-sm mb-3 ${
                                notification.read ? 'text-muted-foreground' : 'text-foreground/80'
                              }`}>
                                {notification.message}
                              </p>
                              
                              <div className="flex items-center space-x-2">
                                {!notification.read && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => markAsRead(notification.id)}
                                    className="text-xs h-7"
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    อ่านแล้ว
                                  </Button>
                                )}
                                
                                {notification.actionUrl && (
                                  <Button
                                    size="sm"
                                    className="text-xs h-7"
                                    onClick={() => window.location.href = notification.actionUrl!}
                                  >
                                    ดูรายละเอียด
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotificationsPage;