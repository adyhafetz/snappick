import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isErrorWithCode, isSuccessResponse, GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<Profile>;
};

export type Profile = {
  id: string;
  display_name: string | null;
  phone: string | null;
  image_storage_consent: boolean;
  image_storage_consent_at: string | null;
  image_storage_consent_version: number | null;
  community_pickup_safety_acknowledged: boolean;
  community_pickup_safety_acknowledged_at: string | null;
  community_pickup_safety_acknowledged_version: number | null;
  training_opt_in: boolean;
  training_opt_in_at: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdate = Partial<Pick<Profile,
  | 'display_name'
  | 'phone'
  | 'image_storage_consent'
  | 'image_storage_consent_at'
  | 'image_storage_consent_version'
  | 'community_pickup_safety_acknowledged'
  | 'community_pickup_safety_acknowledged_at'
  | 'community_pickup_safety_acknowledged_version'
  | 'training_opt_in'
  | 'training_opt_in_at'
>>;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let profileRequest = 0;
    async function loadProfile(userId: string) {
      const requestId = ++profileRequest;
      setProfileLoading(true);
      setProfileError(null);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!mounted || requestId !== profileRequest) return;
      setProfileLoading(false);
      if (error) {
        setProfile(null);
        setProfileError(`We could not load your profile. ${error.message}`);
        return;
      }
      setProfile(data as Profile);
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.warn('Unable to restore the saved session:', error.message);
      const restoredSession = data.session;
      setSession(restoredSession);
      setLoading(false);
      if (restoredSession) setTimeout(() => void loadProfile(restoredSession.user.id), 0);
      else setProfile(null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (nextSession) setTimeout(() => void loadProfile(nextSession.user.id), 0);
      else {
        profileRequest += 1;
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
      }
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading,
    profile,
    profileLoading,
    profileError,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(toAuthMessage(error.message));
    },
    async signInWithGoogle() {
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (!webClientId) throw new Error('Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and rebuild the app.');
      try {
        GoogleSignin.configure({ webClientId });
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        if (!isSuccessResponse(response)) return;
        if (!response.data.idToken) throw new Error('Google did not return an ID token. Check the Web OAuth client configuration.');
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: response.data.idToken });
        if (error) throw new Error(toAuthMessage(error.message));
      } catch (error) {
        if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return;
        throw new Error(toGoogleMessage(error));
      }
    },
    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw new Error(toAuthMessage(error.message));
      return { needsEmailConfirmation: !data.session };
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(toAuthMessage(error.message));
    },
    async refreshProfile() {
      if (!session) return;
      setProfileError(null);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (error) {
        const message = `We could not load your profile. ${error.message}`;
        setProfileError(message);
        throw new Error(message);
      }
      setProfile(data as Profile);
    },
    async updateProfile(patch) {
      if (!session) throw new Error('You must be signed in to update your profile.');
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', session.user.id).select('*').single();
      if (error) throw new Error(`We could not save your profile. ${error.message}`);
      const nextProfile = data as Profile;
      setProfile(nextProfile);
      return nextProfile;
    },
  }), [loading, profile, profileError, profileLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

function toAuthMessage(message: string) {
  const normalised = message.toLowerCase();
  if (normalised.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (normalised.includes('email not confirmed')) return 'Confirm your email address before signing in.';
  if (normalised.includes('user already registered')) return 'An account with this email already exists.';
  if (normalised.includes('password')) return 'Use a password with at least 6 characters.';
  return message;
}

function toGoogleMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('play services')) return 'Google Play Services is unavailable or needs an update.';
    if (message.includes('developer_error')) return 'Google sign-in is not configured for this Android build. Check the package name and SHA-1.';
    return error.message;
  }
  return 'Google sign-in failed. Try again.';
}
