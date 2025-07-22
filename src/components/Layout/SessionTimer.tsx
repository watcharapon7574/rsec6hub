import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { getSessionTimeRemaining } from '@/services/authService';
import { signOut } from '@/services/auth/signOut';

const SessionTimer = () => {
  const [timeRemaining, setTimeRemaining] = useState(getSessionTimeRemaining());
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
    if (timeRemaining === null || (timeRemaining && timeRemaining.hours === 0 && timeRemaining.minutes === 0 && timeRemaining.seconds === 0)) {
      (async () => {
        await signOut();
        navigate('/auth');
      })();
    }
  }, [timeRemaining, navigate]);

  if (!timeRemaining) return null;

  const { hours, minutes, seconds, isExpiring } = timeRemaining;
  const formatTime = (time: number) => time.toString().padStart(2, '0');

  return (
    <span className="flex items-center gap-1">
      {/* นาฬิกา (เทา ถ้าใกล้หมดเวลาเป็นแดง) */}
      <Clock className={`h-3 w-3 ${isExpiring ? 'text-destructive' : 'text-gray-400'}`} />
      {/* เวลา (แดงถ้าใกล้หมดเวลา, เทาถ้าไม่ใกล้) */}
      <span className={isExpiring ? 'text-destructive' : 'text-gray-400'}>
        {formatTime(hours)}:{formatTime(minutes)}:{formatTime(seconds)}
      </span>
    </span>
  );
};

export default SessionTimer;