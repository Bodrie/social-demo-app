import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput } from '@the-mesh/shared';
import { login, logout, register } from '@/lib/api/auth';
import { endSession, startSession } from './use-me';

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (me) => startSession(queryClient, me),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => register(input),
    onSuccess: (me) => startSession(queryClient, me),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    // The cookies are gone either way; make the UI agree even if the request failed.
    onSettled: () => endSession(queryClient),
  });
}
