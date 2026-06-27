import { create } from 'zustand';

interface ForgotPasswordState {
  step: 1 | 2 | 3;
  email: string;
  setEmail: (email: string) => void;
  advance: () => void;
  reset: () => void;
}

export const useForgotPasswordStore = create<ForgotPasswordState>()((set) => ({
  step: 1,
  email: '',
  setEmail: (email) => set({ email }),
  advance: () =>
    set((state) => ({
      step: state.step < 3 ? ((state.step + 1) as 1 | 2 | 3) : 3,
    })),
  reset: () => set({ step: 1, email: '' }),
}));
