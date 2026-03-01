import { createContext, useContext, useReducer, useEffect } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import {
  COGNITO_CONFIGURED,
  getIdToken,
  signIn,
  signUp,
  confirmSignUp,
  signOut,
} from '../services/auth.js';

const AuthContext = createContext(null);

// ── Reducer ───────────────────────────────────────────────────────────────────

const initialState = {
  user:      null,   // { sub: string, email: string } | null
  loading:   true,
  authError: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false, authError: null };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, authError: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, authError: null };
    case 'SIGN_OUT':
      return { ...state, user: null, loading: false, authError: null };
    default:
      return state;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // On mount: check if a Cognito session already exists (e.g. persisted from previous visit)
  useEffect(() => {
    if (!COGNITO_CONFIGURED) {
      // Running in localStorage-only mode — skip auth
      dispatch({ type: 'SET_USER', payload: null });
      return;
    }
    getCurrentUser()
      .then(user =>
        dispatch({
          type:    'SET_USER',
          payload: { sub: user.userId, email: user.signInDetails?.loginId ?? '' },
        })
      )
      .catch(() => dispatch({ type: 'SET_USER', payload: null }));
  }, []);

  // ── Auth operations ───────────────────────────────────────────────────────

  const handleSignIn = async (email, password) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      await signIn({ username: email, password });
      const user = await getCurrentUser();
      dispatch({
        type:    'SET_USER',
        payload: { sub: user.userId, email: user.signInDetails?.loginId ?? email },
      });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message ?? 'Sign-in failed' });
      throw err;
    }
  };

  const handleSignUp = async (email, password) => {
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      return await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message ?? 'Sign-up failed' });
      throw err;
    }
  };

  const handleConfirmSignUp = async (email, code) => {
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      return await confirmSignUp({ username: email, confirmationCode: code });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message ?? 'Confirmation failed' });
      throw err;
    }
  };

  const handleSignOut = async () => {
    await signOut();
    // Clear cached app data so next user starts fresh
    localStorage.removeItem('ballpark_visits');
    localStorage.removeItem('ballpark_trips');
    dispatch({ type: 'SIGN_OUT' });
  };

  return (
    <AuthContext.Provider
      value={{
        user:            state.user,
        loading:         state.loading,
        authError:       state.authError,
        isAuthenticated: !!state.user,
        signIn:          handleSignIn,
        signUp:          handleSignUp,
        confirmSignUp:   handleConfirmSignUp,
        signOut:         handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
