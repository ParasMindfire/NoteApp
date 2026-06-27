import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { loginSchema, type LoginInput } from '@noteapp/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errorMessages';
import { useMinDuration } from '@/hooks/useMinDuration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string };
}

export function LoginForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: LoginInput) =>
      api.post<LoginResponse>('/auth/login', data).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
      const next = searchParams.get('next');
      const destination = next && next.startsWith('/') ? next : '/notes';
      navigate(destination, { replace: true });
    },
    onError: (error: unknown) => {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'AUTH_INVALID_CREDENTIALS') {
        form.setValue('password', '');
        form.setError('password', { message: getErrorMessage(code) });
        setTimeout(() => passwordRef.current?.focus(), 0);
      } else {
        form.setError('root', { message: getErrorMessage(code) });
      }
    },
  });

  const isVisible = useMinDuration(mutation.isPending);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
        className="space-y-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  aria-label="Email"
                  aria-invalid={!!form.formState.errors.email}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  aria-label="Password"
                  aria-invalid={!!form.formState.errors.password}
                  {...field}
                  ref={(el) => {
                    field.ref(el);
                    (passwordRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                  }}
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
          disabled={!form.formState.isValid || isVisible}
        >
          Sign in
        </Button>
      </form>
    </Form>
  );
}
