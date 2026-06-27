import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setNavigate } from '@/lib/navigation';

export function NavigationSetter() {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigate(navigate);
    return () => setNavigate(navigate);
  }, [navigate]);

  return null;
}
