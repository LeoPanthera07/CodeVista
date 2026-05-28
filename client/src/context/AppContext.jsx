import { createContext, useContext, useReducer, useCallback, useRef } from 'react';

const AppContext = createContext(null);

const initialState = {
  repositories: [],
  selectedRepo: null,
  repoLoading: false,
  repoError: null,

  chatMessages: [],
  chatLoading: false,

  toasts: [],

  sidebarOpen: true,
  mobileMenuOpen: false,

  // Auth State
  user: localStorage.getItem('codevista_user') ? (() => {
    try {
      return JSON.parse(localStorage.getItem('codevista_user'));
    } catch {
      return null;
    }
  })() : null,
  token: localStorage.getItem('codevista_token') || null,
  groqApiKey: localStorage.getItem('codevista_groq_api_key') || null,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_REPOSITORIES':
      return { ...state, repositories: action.payload, repoLoading: false, repoError: null };
    case 'SET_REPO_LOADING':
      return { ...state, repoLoading: action.payload };
    case 'SET_REPO_ERROR':
      return { ...state, repoError: action.payload, repoLoading: false };
    case 'ADD_REPOSITORY':
      return { ...state, repositories: [action.payload, ...state.repositories] };
    case 'UPDATE_REPOSITORY':
      return {
        ...state,
        repositories: state.repositories.map(r =>
          r.id === action.payload.id ? { ...r, ...action.payload } : r
        ),
        selectedRepo: state.selectedRepo?.id === action.payload.id
          ? { ...state.selectedRepo, ...action.payload }
          : state.selectedRepo,
      };
    case 'SET_SELECTED_REPO':
      return { ...state, selectedRepo: action.payload };
    case 'REMOVE_REPOSITORY':
      return {
        ...state,
        repositories: state.repositories.filter(r => r.id !== action.payload),
        selectedRepo: state.selectedRepo?.id === action.payload ? null : state.selectedRepo,
      };

    case 'SET_CHAT_MESSAGES':
      return { ...state, chatMessages: action.payload };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.payload] };
    case 'UPDATE_LAST_AI_MESSAGE':
      return {
        ...state,
        chatMessages: state.chatMessages.map((msg, i) =>
          i === state.chatMessages.length - 1 && msg.role === 'assistant'
            ? { ...msg, content: msg.content + action.payload }
            : msg
        ),
      };
    case 'SET_CHAT_LOADING':
      return { ...state, chatLoading: action.payload };

    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_MOBILE_MENU':
      return { ...state, mobileMenuOpen: action.payload };

    case 'LOGIN_SUCCESS':
      localStorage.setItem('codevista_token', action.payload.token);
      localStorage.setItem('codevista_user', JSON.stringify(action.payload.user));
      if (action.payload.user.groq_api_key) {
        localStorage.setItem('codevista_groq_api_key', action.payload.user.groq_api_key);
      } else {
        localStorage.removeItem('codevista_groq_api_key');
      }
      return {
        ...state,
        token: action.payload.token,
        user: action.payload.user,
        groqApiKey: action.payload.user.groq_api_key || null,
      };

    case 'LOGOUT':
      localStorage.removeItem('codevista_token');
      localStorage.removeItem('codevista_user');
      localStorage.removeItem('codevista_groq_api_key');
      return {
        ...state,
        token: null,
        user: null,
        groqApiKey: null,
        repositories: [],
        selectedRepo: null,
        chatMessages: [],
      };

    case 'UPDATE_USER_KEY':
      if (action.payload) {
        localStorage.setItem('codevista_groq_api_key', action.payload);
      } else {
        localStorage.removeItem('codevista_groq_api_key');
      }
      return {
        ...state,
        groqApiKey: action.payload || null,
        user: state.user ? { ...state.user, groq_api_key: action.payload || null } : null,
      };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const toastIdRef = useRef(0);

  const addToast = useCallback((toast) => {
    const id = ++toastIdRef.current;
    const duration = toast.duration || 5000;
    dispatch({ type: 'ADD_TOAST', payload: { ...toast, id, duration } });
    setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: id });
    }, duration);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  const value = {
    state,
    dispatch,
    addToast,
    removeToast,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

export default AppContext;
