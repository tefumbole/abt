import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/** Timesheet login uses the shared OTP login flow for all users. */
const TimeSheetLoginPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login?redirect=/timesheet/monthly-summary', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-[#003D82] gap-2">
      <Loader2 className="w-6 h-6 animate-spin" />
      Redirecting to secure login…
    </div>
  );
};

export default TimeSheetLoginPage;
