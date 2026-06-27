import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { registerSchema, type RegisterInput, type LoginInput } from '@noteapp/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errorMessages';
import { useMinDuration } from '@/hooks/useMinDuration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string };
}

export function RegisterForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: async (data: RegisterInput) => {
      await api.post('/auth/register', data);
      const loginData: LoginInput = { email: data.email, password: data.password };
      const loginRes = await api.post<LoginResponse>('/auth/login', loginData);
      return loginRes.data;
    },
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
      const next = searchParams.get('next');
      navigate(next && next.startsWith('/') ? next : '/notes', { replace: true });
    },
    onError: (error: unknown) => {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'USER_EXISTS') {
        form.setError('email', { message: getErrorMessage(code) });
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
              {form.formState.errors.email?.message === 'Account already exists. Try logging in.' && (
                <p className="text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                    Go to login
                  </Link>
                </p>
              )}
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
          Create account
        </Button>
      </form>
    </Form>
  );
}
