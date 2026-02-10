import React from 'react';
import { CheckCircle, FileText, Users, MessageSquare, ClipboardList, Calendar, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
}

interface Step4ReviewProps {
  subject: string;
  docNumber: string | null;
  selectedUsers: Profile[];
  note: string;
  taskDescription?: string;
  eventDate?: Date | null;
  eventTime?: string;
  location?: string;
}

const Step4Review: React.FC<Step4ReviewProps> = ({
  subject,
  docNumber,
  selectedUsers,
  note,
  taskDescription,
  eventDate,
  eventTime,
  location
}) => {
  // Format date for display
  const formatDisplayDate = (date: Date | null | undefined) => {
    if (!date) return null;
    return format(date, 'd MMMM yyyy', { locale: th });
  };

  // Format time for display
  const formatDisplayTime = (time: string | undefined) => {
    if (!time) return null;
    return time + ' น.';
  };
  return (
    <div className="space-y-6">
      <Card className="bg-card border-2 border-pink-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-pink-50 to-pink-100 border-b border-pink-200">
          <CardTitle className="flex items-center text-lg text-pink-900">
            <CheckCircle className="h-5 w-5 mr-2 text-pink-600" />
            ตรวจสอบข้อมูลก่อนมอบหมาย
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Document Info */}
          <div>
            <div className="flex items-center mb-3">
              <FileText className="h-4 w-4 mr-2 text-pink-600" />
              <h3 className="font-semibold text-pink-900">เอกสาร</h3>
            </div>
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 space-y-2">
              <div>
                <span className="text-sm text-pink-600 font-medium">เรื่อง: </span>
                <span className="text-sm text-muted-foreground">{subject}</span>
              </div>
              {docNumber && (
                <div>
                  <span className="text-sm text-pink-600 font-medium">เลขที่: </span>
                  <span className="text-sm text-muted-foreground">{docNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Selected Users */}
          <div>
            <div className="flex items-center mb-3">
              <Users className="h-4 w-4 mr-2 text-pink-600" />
              <h3 className="font-semibold text-pink-900">
                ผู้รับมอบหมาย ({selectedUsers.length} คน)
              </h3>
            </div>
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <Badge
                    key={user.user_id}
                    variant="secondary"
                    className="px-3 py-1.5 text-sm bg-pink-600 text-white border-none"
                  >
                    {user.first_name} {user.last_name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Task Description */}
          {taskDescription && (
            <div>
              <div className="flex items-center mb-3">
                <ClipboardList className="h-4 w-4 mr-2 text-pink-600" />
                <h3 className="font-semibold text-pink-900">รายละเอียดงาน</h3>
              </div>
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{taskDescription}</p>
              </div>
            </div>
          )}

          {/* Date/Time and Location Row */}
          {(eventDate || eventTime || location) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Event Date/Time */}
              {(eventDate || eventTime) && (
                <div>
                  <div className="flex items-center mb-3">
                    <Calendar className="h-4 w-4 mr-2 text-pink-600" />
                    <h3 className="font-semibold text-pink-900">วันที่/เวลา</h3>
                  </div>
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                    <div className="flex flex-col gap-1">
                      {eventDate && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 text-pink-500" />
                          {formatDisplayDate(eventDate)}
                        </div>
                      )}
                      {eventTime && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 text-pink-500" />
                          {formatDisplayTime(eventTime)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Location */}
              {location && (
                <div>
                  <div className="flex items-center mb-3">
                    <MapPin className="h-4 w-4 mr-2 text-pink-600" />
                    <h3 className="font-semibold text-pink-900">สถานที่</h3>
                  </div>
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">{location}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Note */}
          {note && (
            <div>
              <div className="flex items-center mb-3">
                <MessageSquare className="h-4 w-4 mr-2 text-pink-600" />
                <h3 className="font-semibold text-pink-900">หมายเหตุเพิ่มเติม</h3>
              </div>
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>📋 หมายเหตุ:</strong> เมื่อกดปุ่ม "มอบหมายงาน" งานจะถูกส่งไปยังผู้รับมอบหมายทันที
          และไม่สามารถแก้ไขได้
        </p>
      </div>
    </div>
  );
};

export default Step4Review;
