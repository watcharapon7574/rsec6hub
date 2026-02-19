
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Smartphone, Monitor, Globe, Trash2, Loader2, Shield, RefreshCw } from 'lucide-react';

interface SessionRecord {
  id: string;
  session_token: string;
  device_fingerprint: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

const parseUserAgent = (ua: string | null): { device: string; browser: string; icon: 'mobile' | 'desktop' | 'unknown' } => {
  if (!ua) return { device: 'ไม่ทราบอุปกรณ์', browser: '', icon: 'unknown' };

  let browser = '';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else browser = 'Browser';

  let device = '';
  let icon: 'mobile' | 'desktop' | 'unknown' = 'unknown';

  if (ua.includes('iPhone')) { device = 'iPhone'; icon = 'mobile'; }
  else if (ua.includes('iPad')) { device = 'iPad'; icon = 'mobile'; }
  else if (ua.includes('Android')) {
    icon = 'mobile';
    // Try to extract device model
    const match = ua.match(/Android[^;]*;\s*([^)]+)/);
    device = match ? match[1].trim().split(' Build')[0] : 'Android';
  }
  else if (ua.includes('Windows')) { device = 'Windows PC'; icon = 'desktop'; }
  else if (ua.includes('Macintosh')) { device = 'Mac'; icon = 'desktop'; }
  else if (ua.includes('Linux')) { device = 'Linux'; icon = 'desktop'; }
  else { device = 'อุปกรณ์อื่น'; }

  return { device, browser, icon };
};

const SessionManagement = () => {
  const { user } = useEmployeeAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const currentSessionToken = localStorage.getItem('session_token');

  const fetchSessions = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      let dbSessions = (data as SessionRecord[]) || [];

      // If current device's session is not in DB, add a virtual entry
      if (currentSessionToken && !dbSessions.some(s => s.session_token === currentSessionToken)) {
        const storedAuth = localStorage.getItem('employee_auth');
        let loginTime = new Date().toISOString();
        if (storedAuth) {
          try {
            const parsed = JSON.parse(storedAuth);
            if (parsed.loginTime) loginTime = new Date(parsed.loginTime).toISOString();
          } catch {}
        }
        dbSessions = [{
          id: 'current-device',
          session_token: currentSessionToken,
          device_fingerprint: localStorage.getItem('device_fingerprint'),
          user_agent: navigator.userAgent,
          created_at: loginTime,
          expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          is_active: true,
        }, ...dbSessions];
      }

      setSessions(dbSessions);
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูล session ได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [user?.id]);

  const terminateSession = async (sessionId: string, sessionToken: string) => {
    setTerminatingId(sessionId);
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false, expires_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast({
        title: 'ยกเลิก session สำเร็จ',
        description: 'อุปกรณ์นั้นจะถูกเตะออกจากระบบ',
      });
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setTerminatingId(null);
    }
  };

  const terminateAllOtherSessions = async () => {
    if (!user?.id || !currentSessionToken) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false, expires_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_active', true)
        .neq('session_token', currentSessionToken);

      if (error) throw error;

      setSessions(prev => prev.filter(s => s.session_token === currentSessionToken || s.id === 'current-device'));
      toast({
        title: 'ยกเลิกทุก session สำเร็จ',
        description: 'อุปกรณ์อื่นทั้งหมดจะถูกเตะออกจากระบบ',
      });
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">กำลังโหลด...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-foreground">อุปกรณ์ที่เข้าสู่ระบบ</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {sessions.length} เซสชัน
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchSessions}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {sessions.filter(s => s.session_token !== currentSessionToken).length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={terminateAllOtherSessions}
            >
              ออกจากอุปกรณ์อื่นทั้งหมด
            </Button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          ไม่พบ session ที่ active
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const isCurrentSession = session.session_token === currentSessionToken;
            const { device, browser, icon } = parseUserAgent(session.user_agent);
            const DeviceIcon = icon === 'mobile' ? Smartphone : icon === 'desktop' ? Monitor : Globe;

            return (
              <div
                key={session.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isCurrentSession
                    ? 'border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${
                    isCurrentSession
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <DeviceIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {device}
                      </span>
                      {browser && (
                        <span className="text-xs text-muted-foreground">
                          ({browser})
                        </span>
                      )}
                      {isCurrentSession && (
                        <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                          เครื่องนี้
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      เข้าสู่ระบบ: {formatDate(session.created_at)}
                    </div>
                  </div>
                </div>

                {!isCurrentSession && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    onClick={() => terminateSession(session.id, session.session_token)}
                    disabled={terminatingId === session.id}
                  >
                    {terminatingId === session.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SessionManagement;
