import React, { useEffect, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Alert,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { syncEngine } from '../sync/syncEngine';
import { SyncState } from '../types/customer';
import { AppIcon } from './AppIcon';

interface SyncIndicatorProps {
  compact?: boolean;
  showLabel?: boolean;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  compact = false,
  showLabel = true,
}) => {
  const { isDark } = useTheme();
  const [syncState, setSyncState] = useState<SyncState>(syncEngine.getState());
  const [spinAnim] = useState(() => new Animated.Value(0));
  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  // Continuous modern spin animation during sync
  useEffect(() => {
    let spinLoop: Animated.CompositeAnimation | null = null;
    let pulseLoop: Animated.CompositeAnimation | null = null;

    if (syncState.status === 'syncing') {
      spinAnim.setValue(0);
      spinLoop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      spinLoop.start();

      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 450,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      pulseLoop.start();
    } else {
      spinAnim.setValue(0);
      pulseAnim.setValue(1);
    }

    return () => {
      spinLoop?.stop();
      pulseLoop?.stop();
    };
  }, [syncState.status, pulseAnim, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handlePress = () => {
    // 1. Immediately trigger sync
    syncEngine.syncNow();

    // 2. Immediate responsive spin animation feedback on tap
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    // 3. Inform user if offline or if there is an active error
    if (syncState.status === 'offline') {
      Alert.alert(
        'Offline Mode',
        'Your device is currently offline. All ledger entries are saved safely on your device and will automatically sync when internet connects.',
        [{ text: 'OK' }]
      );
    } else if (syncState.status === 'error') {
      Alert.alert(
        'Sync Error',
        syncState.errorMessage || 'Unable to connect to cloud server. Retrying now...',
        [
          { text: 'Close', style: 'cancel' },
          { text: 'Retry Now', onPress: () => syncEngine.syncNow() },
        ]
      );
    }
  };

  const handleLongPress = () => {
    const lastSyncTime = syncState.lastSyncedAt
      ? new Date(syncState.lastSyncedAt).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : 'Just now';

    Alert.alert(
      'Cloud Sync Status',
      `Status: ${config.label}\nLast synced: ${lastSyncTime}\nPending offline records: ${syncState.pendingCount}`,
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Sync Now',
          onPress: () => {
            syncEngine.syncNow();
          },
        },
      ]
    );
  };

  // Determine Visual Status Theme
  // GREEN = Success / Fully Synced
  // RED = Error / Failed
  // WARNING / AMBER = Warning / Offline / Pending changes
  // BLUE = Syncing
  const getStatusConfig = () => {
    if (syncState.status === 'syncing') {
      return {
        bg: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF',
        border: isDark ? 'rgba(59, 130, 246, 0.35)' : '#BFDBFE',
        textColor: isDark ? '#60A5FA' : '#2563EB',
        dotColor: '#3B82F6',
        label: 'Syncing',
        isSyncing: true,
      };
    }

    if (syncState.status === 'error') {
      return {
        bg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
        border: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
        textColor: isDark ? '#F87171' : '#DC2626',
        dotColor: '#EF4444',
        label: 'Error',
        icon: 'alert-circle',
        family: 'feather' as const,
      };
    }

    if (syncState.status === 'offline' || syncState.pendingCount > 0) {
      return {
        bg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB',
        border: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A',
        textColor: isDark ? '#FBBF24' : '#D97706',
        dotColor: '#F59E0B',
        label: syncState.pendingCount > 0 ? `${syncState.pendingCount} Pending` : 'Offline',
        icon: syncState.pendingCount > 0 ? 'clock' : 'cloud-off',
        family: 'feather' as const,
      };
    }

    // Default: Fully Synced (GREEN)
    return {
      bg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
      border: isDark ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0',
      textColor: isDark ? '#34D399' : '#059669',
      dotColor: '#10B981',
      label: 'Synced',
      icon: 'cloud-check',
      family: 'material' as const,
    };
  };

  const config = getStatusConfig();

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.65}
      hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={`Cloud Sync: Status ${config.label}. Tap to sync immediately, long press for details`}
      accessibilityHint="Tap to synchronize data with cloud immediately"
      style={[
        styles.pillContainer,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingHorizontal: compact ? 8 : 10,
        },
      ]}
    >
      {config.isSyncing ? (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <AppIcon
            family="feather"
            name="refresh-cw"
            size={13}
            color={config.textColor}
          />
        </Animated.View>
      ) : (
        <AppIcon
          family={config.family || 'feather'}
          name={config.icon || 'cloud-check'}
          size={14}
          color={config.textColor}
        />
      )}

      {showLabel && !compact && (
        <Text style={[styles.statusText, { color: config.textColor }]}>
          {config.label}
        </Text>
      )}

      {/* Modern Micro Status Indicator Dot with Pulse */}
      {config.isSyncing ? (
        <Animated.View
          style={[
            styles.statusDot,
            {
              backgroundColor: config.dotColor,
              opacity: pulseAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.statusDot,
            { backgroundColor: config.dotColor },
          ]}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pillContainer: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1,
    gap: 6,
  },
  iconShift: {
    transform: [{ scale: 0.8 }],
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
