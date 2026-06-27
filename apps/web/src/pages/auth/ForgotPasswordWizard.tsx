import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { forgotPasswordSchema, resetPasswordSchema, type ForgotPasswordInput, type ResetPasswordInput } from '@noteapp/shared';
import { api } from '@/lib/api';
import { useForgotPasswordStore } from '@/stores/forgotPasswordStore';
import { getErrorMessage } from '@/lib/errorMessages';
import { useMinDuration } from '@/hooks/useMinDuration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { OtpInput } from '@/components/auth/OtpInput';

function Step1() {
  const { email, setEmail, advance } = useForgotPasswordStore();
  const [isPending, setIsPending] = useState(false);
  const isVisible = useMinDuration(isPending);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
    defaultValues: { email },
  });

  async function onSubmit(data: ForgotPasswordInput) {
    setIsPending(true);
    setEmail(data.email);
    try {
      await api.post('/auth/forgot-password', data);
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (!code) {
        toast.error('Network error, please try again.');
        setIsPending(false);
        return;
      }
    } finally {
      setIsPending(false);
    }
    advance();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  aria-label="Email address"
                  aria-invalid={!!form.formState.errors.email}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" isLoading={isVisible}>
          Send reset code
        </Button>
      </form>
    </Form>
  );
}

function Step2() {
  const { email, advance } = useForgotPasswordStore();
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');

  const form = useForm<Omit<ResetPasswordInput, 'email' | 'otp'>>({
    resolver: zodResolver(resetPasswordSchema.pick({ newPassword: true })),
    mode: 'onBlur',
    defaultValues: { newPassword: '' },
  });

  const [isPending, setIsPending] = useState(false);
  const isVisible = useMinDuration(isPending);

  async function onSubmit(data: { newPassword: string }) {
    setOtpError('');
    setIsPending(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword: data.newPassword });
      advance();
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'AUTH_OTP_INVALID') {
        setOtpError(getErrorMessage(code));
      } else {
        form.setError('root', { message: getErrorMessage(code) });
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Enter the 6-digit code sent to <strong>{email}</strong>
        </p>
        <OtpInput value={otp} onChange={setOtp} disabled={isVisible} />
        {otpError && (
          <p className="mt-2 text-sm text-destructive text-center" role="alert">
            {otpError}
          </p>
        )}
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    aria-label="New password"
                    aria-invalid={!!form.formState.errors.newPassword}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.formState.errors.root && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.root.message}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            isLoading={isVisible}
            disabled={otp.length < 6 || isVisible}
          >
            Reset password
          </Button>
        </form>
      </Form>
    </div>
  );
}

function Step3() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/login', { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="text-center space-y-4">
      <div className="text-4xl">✓</div>
      <h2 className="text-xl font-semibold">Password reset!</h2>
      <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
      <Button onClick={() => navigate('/login', { replace: true })} className="w-full">
        Back to login
      </Button>
    </div>
  );
}

export function ForgotPasswordWizard() {
  const step = useForgotPasswordStore((s) => s.step);

  return (
    <div>
      {step === 1 && <Step1 />}
      {step === 2 && <Step2 />}
      {step === 3 && <Step3 />}
    </div>
  );
}
