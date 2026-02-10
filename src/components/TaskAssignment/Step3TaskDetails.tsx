import React, { useMemo, useState } from 'react';
import { ClipboardList, Users, FileText, Calendar, Clock, MapPin, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import LocationCombobox from './LocationCombobox';

// Generate time options with 5-minute intervals
const generateTimeOptions = () => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      options.push({
        value: `${h}:${m}`,
        label: `${h}:${m} น.`
      });
    }
  }
  return options;
};

const ALL_TIME_OPTIONS = generateTimeOptions();

// Reorder time options to start from current time (rounded to 5 min)
const getReorderedTimeOptions = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = Math.floor(now.getMinutes() / 5) * 5;
  const currentTimeValue = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

  const currentIndex = ALL_TIME_OPTIONS.findIndex(opt => opt.value === currentTimeValue);
  if (currentIndex === -1) return ALL_TIME_OPTIONS;

  // Reorder: current time first, then wrap around
  return [...ALL_TIME_OPTIONS.slice(currentIndex), ...ALL_TIME_OPTIONS.slice(0, currentIndex)];
};

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
}

interface Step3TaskDetailsProps {
  // Who - Selected users from Step2
  selectedUsers: Profile[];

  // What - Task description
  taskDescription: string;
  onTaskDescriptionChange: (desc: string) => void;

  // When - Event date and time
  eventDate: Date | null;
  onEventDateChange: (date: Date | null) => void;
  eventTime: string;
  onEventTimeChange: (time: string) => void;

  // Where - Location
  location: string;
  onLocationChange: (location: string) => void;

  // Note - Additional note (original field)
  note: string;
  onNoteChange: (note: string) => void;
}

const Step3TaskDetails: React.FC<Step3TaskDetailsProps> = ({
  selectedUsers,
  taskDescription,
  onTaskDescriptionChange,
  eventDate,
  onEventDateChange,
  eventTime,
  onEventTimeChange,
  location,
  onLocationChange,
  note,
  onNoteChange
}) => {
  // State for controlling time picker popover
  const [timePopoverOpen, setTimePopoverOpen] = useState(false);

  // Format date for display
  const formatDisplayDate = (date: Date | null) => {
    if (!date) return '';
    return format(date, 'd MMMM yyyy', { locale: th });
  };

  // Get time options reordered from current time (memoized)
  const timeOptions = useMemo(() => getReorderedTimeOptions(), []);

  return (
    <Card className="bg-card border-2 border-pink-200 dark:border-pink-800 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="bg-gradient-to-r from-pink-50 to-pink-100 border-b border-pink-200 dark:border-pink-800">
        <CardTitle className="flex items-center text-lg text-pink-900 dark:text-pink-100">
          <ClipboardList className="h-5 w-5 mr-2 text-pink-600" />
          รายละเอียดการมอบหมายงาน
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {/* Who - Selected Users */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-pink-500" />
            ผู้รับมอบหมาย
          </Label>
          <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg border">
            {selectedUsers.slice(0, 5).map((user) => (
              <Badge
                key={user.user_id}
                variant="secondary"
                className="bg-pink-100 text-pink-700"
              >
                {user.first_name} {user.last_name}
              </Badge>
            ))}
            {selectedUsers.length > 5 && (
              <Badge variant="secondary" className="bg-muted text-foreground">
                +{selectedUsers.length - 5} คน
              </Badge>
            )}
          </div>
        </div>

        <div className="border-t border-border" />

        {/* What - Task Description */}
        <div className="space-y-2">
          <Label htmlFor="task-description" className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-pink-500" />
            รายละเอียดงาน
          </Label>
          <Textarea
            id="task-description"
            placeholder="ระบุรายละเอียดงานที่ต้องทำ... (ไม่จำเป็น)"
            value={taskDescription}
            onChange={(e) => onTaskDescriptionChange(e.target.value)}
            rows={4}
            className="resize-none border-pink-200 dark:border-pink-800 focus:border-pink-500 focus:ring-pink-500"
          />
        </div>

        {/* When & Where - Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* When - Date and Time */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-pink-500" />
              วันที่
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal border-pink-200 dark:border-pink-800 hover:border-pink-300 dark:border-pink-700"
                >
                  <Calendar className="mr-2 h-4 w-4 text-pink-500" />
                  {eventDate ? formatDisplayDate(eventDate) : (
                    <span className="text-muted-foreground">เลือกวันที่...</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-card" align="start">
                <CalendarComponent
                  mode="single"
                  selected={eventDate || undefined}
                  onSelect={(date) => onEventDateChange(date || null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Time - Popover with scrollable list */}
            <Popover open={timePopoverOpen} onOpenChange={setTimePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal border-pink-200 dark:border-pink-800 hover:border-pink-300 dark:border-pink-700"
                >
                  <Clock className="mr-2 h-4 w-4 text-pink-500" />
                  {eventTime ? (
                    <span>{eventTime} น.</span>
                  ) : (
                    <span className="text-muted-foreground">เลือกเวลา...</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0 bg-card" align="start">
                <div className="max-h-[250px] overflow-y-auto">
                  {timeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onEventTimeChange(option.value);
                        setTimePopoverOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-pink-50 dark:hover:bg-pink-950 dark:bg-pink-950 transition-colors ${
                        eventTime === option.value
                          ? 'bg-pink-100 text-pink-700 font-medium'
                          : 'text-foreground'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Where - Location */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-pink-500" />
              สถานที่
            </Label>
            <LocationCombobox
              value={location}
              onChange={onLocationChange}
              placeholder="เลือกหรือพิมพ์สถานที่..."
            />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Note - Additional notes */}
        <div className="space-y-2">
          <Label htmlFor="note" className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4 text-pink-500" />
            หมายเหตุเพิ่มเติม
          </Label>
          <Textarea
            id="note"
            placeholder="ข้อความเพิ่มเติม... (ไม่จำเป็น)"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={2}
            className="resize-none border-pink-200 dark:border-pink-800 focus:border-pink-500 focus:ring-pink-500"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          ข้อมูลนี้จะถูกส่งไปยังผู้รับมอบหมายทุกคน
        </p>
      </CardContent>
    </Card>
  );
};

export default Step3TaskDetails;
