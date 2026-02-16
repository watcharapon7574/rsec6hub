import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  X,
  Clock,
  ServerOff,
  FileText,
  Stamp,
  FileSignature,
  FileCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface RailwaySchedule {
  start_time: string;
  stop_time: string;
  days_of_week: number[];
  enabled: boolean;
  service_name: string;
}

type BannerStatus = "active" | "warning" | "offline";

const AFFECTED_FEATURES = [
  { name: "สร้างบันทึกข้อความ", icon: FileText },
  { name: "สร้างรายงานบันทึกข้อความ", icon: FileText },
  { name: "สร้างหนังสือรับ", icon: Stamp },
  { name: "จัดการเอกสาร / PDF เอกสาร", icon: FileCheck },
  { name: "อนุมัติ / ลงนามเอกสาร", icon: FileSignature },
  { name: "จัดการ PDF หนังสือรับ", icon: FileCheck },
  { name: "จัดการรายงานบันทึกข้อความ", icon: FileText },
];

const WARNING_MINUTES_BEFORE = 60; // แจ้งเตือนล่วงหน้า 1 ชั่วโมง

export default function APIMaintenanceBanner() {
  const [schedule, setSchedule] = useState<RailwaySchedule | null>(null);
  const [status, setStatus] = useState<BannerStatus>("active");
  const [timeDisplay, setTimeDisplay] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [dialogShownForStatus, setDialogShownForStatus] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const prevStatusRef = useRef<BannerStatus>("active");

  // Fetch schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      const { data, error } = await supabase
        .from("railway_schedules")
        .select("start_time, stop_time, days_of_week, enabled, service_name")
        .eq("enabled", true)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setSchedule(data as RailwaySchedule);
      }
    };

    fetchSchedule();
  }, []);

  // Check time and update status
  const checkStatus = useCallback(() => {
    if (!schedule) return;

    const now = new Date();
    const currentDay = now.getDay();

    if (!schedule.days_of_week.includes(currentDay)) {
      setStatus("offline");
      setTimeDisplay(`เปิดให้บริการวันถัดไป เวลา ${schedule.start_time} น.`);
      return;
    }

    const [stopH, stopM] = schedule.stop_time.split(":").map(Number);
    const [startH, startM] = schedule.start_time.split(":").map(Number);
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const stopMins = stopH * 60 + stopM;
    const startMins = startH * 60 + startM;

    if (currentMins >= stopMins || currentMins < startMins) {
      // นอกเวลาทำการ
      setStatus("offline");
      let minsUntilStart: number;
      if (currentMins >= stopMins) {
        minsUntilStart = 24 * 60 - currentMins + startMins;
      } else {
        minsUntilStart = startMins - currentMins;
      }
      const h = Math.floor(minsUntilStart / 60);
      const m = minsUntilStart % 60;
      setTimeDisplay(
        h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`
      );
    } else if (stopMins - currentMins <= WARNING_MINUTES_BEFORE) {
      // ใกล้ปิดแล้ว
      setStatus("warning");
      const minsLeft = stopMins - currentMins;
      const h = Math.floor(minsLeft / 60);
      const m = minsLeft % 60;
      setTimeDisplay(
        h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`
      );
    } else {
      setStatus("active");
    }
  }, [schedule]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // แสดง Dialog เด้งเมื่อสถานะเปลี่ยนเป็น warning หรือ offline
  useEffect(() => {
    if (
      status !== "active" &&
      status !== prevStatusRef.current &&
      dialogShownForStatus !== status
    ) {
      setShowDialog(true);
      setDialogShownForStatus(status);
      setBannerDismissed(false);
    }
    prevStatusRef.current = status;
  }, [status, dialogShownForStatus]);

  // ไม่แสดงอะไรถ้ายังอยู่ในเวลาทำการปกติ
  if (status === "active" || !schedule) return null;

  const isOffline = status === "offline";

  return (
    <>
      {/* Dialog popup เด้ง */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent
          className={`sm:max-w-md border-2 ${
            isOffline
              ? "border-red-500 dark:border-red-400"
              : "border-amber-500 dark:border-amber-400"
          }`}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-full ${
                  isOffline
                    ? "bg-red-100 dark:bg-red-900/50"
                    : "bg-amber-100 dark:bg-amber-900/50"
                }`}
              >
                {isOffline ? (
                  <ServerOff
                    className="h-6 w-6 text-red-600 dark:text-red-400"
                  />
                ) : (
                  <AlertTriangle
                    className="h-6 w-6 text-amber-600 dark:text-amber-400"
                  />
                )}
              </div>
              <DialogTitle className="text-lg">
                {isOffline
                  ? "ระบบ PDF ปิดให้บริการแล้ว"
                  : "ระบบ PDF กำลังจะปิดให้บริการ"}
              </DialogTitle>
            </div>
            <DialogDescription className="pt-3 text-left">
              {isOffline ? (
                <>
                  ขณะนี้ระบบ PDF ปิดให้บริการแล้ว
                  <br />
                  จะกลับมาเปิดให้บริการอีกครั้งในอีก{" "}
                  <span className="font-semibold text-foreground">
                    {timeDisplay}
                  </span>{" "}
                  (เวลา {schedule.start_time} น.)
                </>
              ) : (
                <>
                  ระบบ PDF จะปิดให้บริการในอีก{" "}
                  <span className="font-semibold text-foreground">
                    {timeDisplay}
                  </span>{" "}
                  (เวลา {schedule.stop_time} น.)
                  <br />
                  กรุณาบันทึกงานที่ค้างอยู่ให้เสร็จก่อนเวลาดังกล่าว
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              เวลาให้บริการ: {schedule.start_time} - {schedule.stop_time} น.
            </p>
            <p className="text-sm font-medium mb-2">
              ฟีเจอร์ที่ได้รับผลกระทบ:
            </p>
            <ul className="space-y-1.5">
              {AFFECTED_FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.name}
                    className={`flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 ${
                      isOffline
                        ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                        : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {feature.name}
                  </li>
                );
              })}
            </ul>
          </div>

          <DialogFooter className="mt-2">
            <Button
              onClick={() => setShowDialog(false)}
              className="w-full sm:w-auto"
            >
              รับทราบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sticky banner (แสดงหลังปิด Dialog) */}
      {!showDialog && !bannerDismissed && (
        <div
          className={`w-full px-3 py-2 text-sm ${
            isOffline
              ? "bg-red-600 dark:bg-red-700 text-white"
              : "bg-amber-500 dark:bg-amber-600 text-white"
          } animate-in slide-in-from-top duration-300`}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isOffline ? (
                <ServerOff className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span className="font-medium truncate">
                {isOffline
                  ? `ระบบ PDF ปิดแล้ว — เปิดอีกครั้ง ${schedule.start_time} น.`
                  : `ระบบ PDF จะปิดในอีก ${timeDisplay} (${schedule.stop_time} น.)`}
              </span>
              <button
                onClick={() => setShowFeatures((v) => !v)}
                className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors hidden sm:block"
                aria-label="ดูรายละเอียด"
              >
                {showFeatures ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setShowDialog(true)}
                className="text-xs underline underline-offset-2 opacity-90 hover:opacity-100 hidden sm:block"
              >
                ดูรายละเอียด
              </button>
              <button
                onClick={() => setBannerDismissed(true)}
                className="p-1 rounded hover:bg-white/20 transition-colors"
                aria-label="ปิด"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {/* Expandable feature list */}
          {showFeatures && (
            <div className="max-w-4xl mx-auto mt-1.5 pt-1.5 border-t border-white/20 text-xs opacity-90">
              ฟีเจอร์ที่ได้รับผลกระทบ:{" "}
              {AFFECTED_FEATURES.map((f) => f.name).join(", ")}
            </div>
          )}
        </div>
      )}
    </>
  );
}
