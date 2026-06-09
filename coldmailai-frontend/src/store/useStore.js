import { create } from 'zustand';

const useStore = create((set) => ({
  accessToken: localStorage.getItem('accessToken') || null,
  user: null,
  emails: [],
  totalEmails: 0,
  currentPage: 1,
  isGenerating: false,
  generatedEmail: null,
  usage: null,
  plans: [],
  notifications: [],

  setToken: (token) => {
    if (token) localStorage.setItem('accessToken', token);
    set({ accessToken: token || null });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ accessToken: null, user: null, generatedEmail: null, usage: null });
  },
  setEmails: (emails, total) => set({ emails, totalEmails: total }),
  addEmail: (email) => set((state) => ({ emails: [email, ...state.emails] })),
  removeEmail: (id) => set((state) => ({ emails: state.emails.filter((email) => email.id !== id) })),
  toggleFavorite: (id) =>
    set((state) => ({
      emails: state.emails.map((email) =>
        email.id === id ? { ...email, isFavorite: !email.isFavorite } : email,
      ),
    })),
  setCurrentPage: (page) => set({ currentPage: page }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGeneratedEmail: (generatedEmail) => set({ generatedEmail }),
  setUsage: (usage) => set({ usage }),
  setPlans: (plans) => set({ plans }),
  addNotification: (notification) => {
    const id = Date.now();
    set((state) => ({ notifications: [...state.notifications, { ...notification, id }] }));
    setTimeout(() => {
      set((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) }));
    }, 4000);
  },
  removeNotification: (id) =>
    set((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) })),
}));

export { useStore };
export default useStore;
