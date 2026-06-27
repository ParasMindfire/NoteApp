import { create } from 'zustand';

export type EditorStatus = 'idle' | 'saving' | 'saved' | 'error';

interface EditorStatusState {
  status: EditorStatus;
  setStatus: (status: EditorStatus) => void;
}

export const useEditorStatusStore = create<EditorStatusState>((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),
}));
