import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { getSessionTimeRemaining } from '@/services/authService';
import { signOut } from '@/services/auth/signOut';

const SessionTimer = () => {
  const [timeRemaining, setTimeRemaining] = useState(getSessionTimeRemaining());
  const prevTimeRef = useRef(timeRemaining);
  const signingOutRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = getSessionTimeRemaining();
      setTimeRemaining(remaining);
      if (!remaining) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (signingOutRef.current) return;

    const shouldSignOut =
      // กรณี 1: เวลาถึง 00:00:00 พอดี
      (timeRemaining && timeRemaining.hours === 0 && timeRemaining.minutes === 0 && timeRemaining.seconds === 0) ||
      // กรณี 2: เวลาเปลี่ยนจากมีค่า → null (timer หมดอายุ ข้ามจาก >0 ไปเป็น null)
      (prevTimeRef.current !== null && timeRemaining === null);

    if (shouldSignOut) {
      signingOutRef.current = true;
      console.log('⏰ Session timer expired, signing out...');
      (async () => {
        await signOut();
        navigate('/auth', { replace: true });
      })();
    }

    prevTimeRef.current = timeRemaining;
  }, [timeRemaining, navigate]);

  if (!timeRemaining) return null;

  const { hours, minutes, seconds, isExpiring } = timeRemaining;
  const formatTime = (time: number) => time.toString().padStart(2, '0');

  return (
    <span className="flex items-center gap-1">
      {/* นาฬิกา (เทา ถ้าใกล้หมดเวลาเป็นแดง) */}
      <Clock className={`h-3 w-3 ${isExpiring ? 'text-destructive' : 'text-muted-foreground'}`} />
      {/* เวลา (แดงถ้าใกล้หมดเวลา, เทาถ้าไม่ใกล้) */}
      <span className={isExpiring ? 'text-destructive' : 'text-muted-foreground'}>
        {formatTime(hours)}:{formatTime(minutes)}:{formatTime(seconds)}
      </span>
    </span>
  );
};

export default SessionTimer;