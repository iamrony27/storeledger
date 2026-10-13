import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  supabase,
  isSupabaseConfigured,
  loadInitialCustomSupabaseConfig,
  ProfileRow,
} from '../lib/supabase';

interface LocalBusinessProfile {
  business_name: string;
  owner_name: string;
  phone: string;
  currency: string;
}

const LOCAL_PROFILE_STORAGE_KEY = '@gwd_book:business_profile';
const GUEST_MODE_STORAGE_KEY = '@gwd_book:guest_mode_enabled';

const DEFAULT_PROFILE: LocalBusinessProfile = {
  business_name: 'Golden Weigh Bridge',
  owner_name: 'Owner',
  phone: '+91 96068 00800',
  currency: 'INR',
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: LocalBusinessProfile | ProfileRow;
  isLoading: boolean;
  isConfigured: boolean;
  isGuestMode: boolean;
  reloadConfig: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    businessName: string,
    ownerName: string,
    phone: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  updateBusinessProfile: (
    businessName: string,
    ownerName: string,
    phone: string
  ) => Promise<{ error: string | null }>;
  setGuestMode: (enabled: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<LocalBusinessProfile | ProfileRow>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGuestMode, setIsGuestModeState] = useState<boolean>(false);
  const [isConfiguredState, setIsConfiguredState] = useState<boolean>(isSupabaseConfigured());
  const isConfigured = isConfiguredState;

  // Fetch Cloud Profile from Supabase
  const fetchCloudProfile = useCallback(async (userId: string) => {
    if (!isConfiguredState) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !error) {
        setProfile(data as ProfileRow);
        await AsyncStorage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Error fetching Supabase profile:', err);
    }
  }, [isConfiguredState]);

  // 1. Initial Load: Load local profile and Supabase session
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        await loadInitialCustomSupabaseConfig();
        const configured = isSupabaseConfigured();
        if (isMounted) {
          setIsConfiguredState(configured);
        }

        // Load local profile cached in AsyncStorage
        const savedProfileRaw = await AsyncStorage.getItem(LOCAL_PROFILE_STORAGE_KEY);
        if (savedProfileRaw && isMounted) {
          try {
            const parsed = JSON.parse(savedProfileRaw);
            setProfile(parsed);
          } catch {
            // ignore JSON parse error
          }
        }

        // Check if guest mode was selected
        const savedGuestMode = await AsyncStorage.getItem(GUEST_MODE_STORAGE_KEY);
        if (savedGuestMode === 'true' && isMounted) {
          setIsGuestModeState(true);
        }

        // If Supabase is configured, check active session
        if (configured) {
          const { data, error } = await supabase.auth.getSession();
          if (!error && data?.session && isMounted) {
            setSession(data.session);
            setUser(data.session.user);
            await fetchCloudProfile(data.session.user.id);
          }
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    // 2. Listen to Supabase Auth state changes if configured
    if (isConfiguredState) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchCloudProfile(newSession.user.id);
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [isConfiguredState, fetchCloudProfile]);

  const refreshProfile = async () => {
    if (user) {
      await fetchCloudProfile(user.id);
    } else {
      const savedProfileRaw = await AsyncStorage.getItem(LOCAL_PROFILE_STORAGE_KEY);
      if (savedProfileRaw) {
        setProfile(JSON.parse(savedProfileRaw));
      }
    }
  };

  // Sign In with Email & Password
  const signInWithEmail = async (email: string, password: string) => {
    if (!isConfigured) {
      return {
        error: 'Supabase credentials are not configured yet. Please configure .env file.',
      };
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setIsGuestModeState(false);
        await AsyncStorage.setItem(GUEST_MODE_STORAGE_KEY, 'false');
        await fetchCloudProfile(data.session.user.id);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to sign in' };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up with Email, Password & Business metadata
  const signUpWithEmail = async (
    email: string,
    password: string,
    businessName: string,
    ownerName: string,
    phone: string
  ) => {
    if (!isConfigured) {
      return {
        error: 'Supabase credentials are not configured yet. Please configure .env file.',
      };
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            business_name: businessName.trim() || 'My Business',
            owner_name: ownerName.trim() || 'Owner',
            phone: phone.trim() || '',
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setIsGuestModeState(false);
        await AsyncStorage.setItem(GUEST_MODE_STORAGE_KEY, 'false');
        await fetchCloudProfile(data.session.user.id);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to sign up' };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Out
  const signOut = async () => {
    try {
      setIsLoading(true);
      if (isConfigured) {
        await supabase.auth.signOut();
      }
      setUser(null);
      setSession(null);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to sign out' };
    } finally {
      setIsLoading(false);
    }
  };

  // Update Profile (Local & Cloud)
  const updateBusinessProfile = async (
    businessName: string,
    ownerName: string,
    phone: string
  ) => {
    const updatedLocal: LocalBusinessProfile = {
      business_name: businessName.trim(),
      owner_name: ownerName.trim(),
      phone: phone.trim(),
      currency: 'INR',
    };

    setProfile((prev) => ({ ...prev, ...updatedLocal }));
    await AsyncStorage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(updatedLocal));

    if (isConfigured && user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            business_name: updatedLocal.business_name,
            owner_name: updatedLocal.owner_name,
            phone: updatedLocal.phone,
          })
          .eq('id', user.id);

        if (error) {
          return { error: error.message };
        }
      } catch (err: any) {
        return { error: err?.message || 'Could not update cloud profile' };
      }
    }

    return { error: null };
  };

  // Set Guest Mode
  const setGuestMode = async (enabled: boolean) => {
    setIsGuestModeState(enabled);
    await AsyncStorage.setItem(GUEST_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
  };

  const reloadConfig = async () => {
    await loadInitialCustomSupabaseConfig();
    const configured = isSupabaseConfigured();
    setIsConfiguredState(configured);
    if (configured) {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setSession(data.session);
        setUser(data.session.user);
        await fetchCloudProfile(data.session.user.id);
      }
    } else {
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isConfigured: isConfiguredState,
        isGuestMode,
        reloadConfig,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        updateBusinessProfile,
        setGuestMode,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
