import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForgotPasswordStore } from '@/stores/forgotPasswordStore';
import { ForgotPasswordWizard } from '@/pages/auth/ForgotPasswordWizard';

export function ForgotPasswordPage() {
  const reset = useForgotPasswordStore((s) => s.reset);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Reset password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll send a code to your email
          </p>
        </div>
        <ForgotPasswordWizard />
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
