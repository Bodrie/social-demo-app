import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@the-mesh/shared';
import {
  forgotPassword,
  login,
  logout,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '@/lib/api/auth';
import { announceSessionChange, endSession, startSession } from './use-me';

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

/** Continues the session only when the API says this browser held it; otherwise nothing changes. */
export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VerifyEmailInput) => verifyEmail(input),
    onSuccess: ({ user }) => {
      if (user) startSession(queryClient, { user });
    },
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: () => resendVerification() });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (input: ForgotPasswordInput) => forgotPassword(input) });
}

export function useResetPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => resetPassword(input),
    onSuccess: (me) => startSession(queryClient, me),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    // The cookies are gone either way; make the UI (and the other tabs) agree even if the
    // request failed.
    onSettled: () => {
      endSession(queryClient, { deliberate: true });
      announceSessionChange();
    },
  });
}
