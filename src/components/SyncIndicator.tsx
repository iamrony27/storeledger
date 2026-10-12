import React, { useEffect, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { syncEngine } from '../sync/syncEngine';
import { SyncState } from '../types/customer';
import { AppIcon } from './AppIcon';

interface SyncIndicatorProps {
  compact?: boolean;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ compact = false }) => {
  const { colors, borderRadius, spacing } = useTheme();
  const [syncState, setSyncState] = useState<SyncState>(syncEngine.getState());

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  const handlePress = () => {
    syncEngine.syncNow();
  };

  const renderContent = () => {
    switch (syncState.status) {
      case 'syncing':
        return (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={colors.primary} />
            {!compact && (
              <Text style={[styles.text, { color: colors.primary }]}>
                Syncing...
              </Text>
            )}
          </View>
        );

      case 'offline':
        return (
          <View style={styles.row}>
            <AppIcon
              family="material"
              name="cloud-off"
              size={14}
              color={colors.warning}
            />
            {!compact && (
              <Text style={[styles.text, { color: colors.warning }]}>
                Offline{syncState.pendingCount > 0 ? ` (${syncState.pendingCount})` : ''}
              </Text>
            )}
          </View>
        );

      case 'error':
        return (
          <View style={styles.row}>
            <AppIcon
              family="material"
              name="sync-problem"
              size={14}
              color={colors.danger}
            />
            {!compact && (
              <Text style={[styles.text, { color: colors.danger }]}>
                Sync Error
              </Text>
            )}
          </View>
        );

      case 'synced':
      default:
        if (syncState.pendingCount > 0) {
          return (
            <View style={styles.row}>
              <AppIcon
                family="material"
                name="cloud-upload"
                size={14}
                color={colors.primary}
              />
              {!compact && (
                <Text style={[styles.text, { color: colors.primary }]}>
                  Pending ({syncState.pendingCount})
                </Text>
              )}
            </View>
          );
        }
        return (
          <View style={styles.row}>
            <AppIcon
              family="material"
              name="cloud-done"
              size={14}
              color={colors.youWillGet}
            />
            {!compact && (
              <Text style={[styles.text, { color: colors.youWillGet }]}>
                Synced
              </Text>
            )}
          </View>
        );
    }
  };

  const getBackgroundColor = () => {
    switch (syncState.status) {
      case 'syncing':
        return colors.primaryLight;
      case 'offline':
        return colors.warningBg;
      case 'error':
        return colors.dangerBg;
      case 'synced':
      default:
        return syncState.pendingCount > 0
          ? colors.primaryLight
          : colors.youWillGetBg;
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          borderRadius: borderRadius.full,
          paddingHorizontal: compact ? spacing.xs + 2 : spacing.sm + 2,
          paddingVertical: spacing.xs,
        },
      ]}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
