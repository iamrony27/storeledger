import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './AppIcon';
import { Badge } from './Badge';
import {
  supabaseUsageMonitor,
  CloudUsageReport,
  QuotaMetricItem,
} from '../usage/supabaseUsageMonitor';

export const CloudUsageCard: React.FC = () => {
  const { colors, borderRadius, spacing } = useTheme();
  const [report, setReport] = useState<CloudUsageReport>(supabaseUsageMonitor.getReport());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = supabaseUsageMonitor.subscribe((updated) => {
      setReport(updated);
    });
    return unsubscribe;
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await supabaseUsageMonitor.refreshUsage();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getWarningColor = (level: string) => {
    switch (level) {
      case 'danger_95':
        return colors.danger;
      case 'warning_85':
      case 'warning_70':
        return colors.warning;
      default:
        return colors.primary;
    }
  };

  const renderProgressBar = (percentage: number = 0, warningLevel: string = 'normal') => {
    const clamped = Math.max(0, Math.min(100, percentage));
    const barColor = getWarningColor(warningLevel);

    return (
      <View
        style={[
          styles.progressTrack,
          { backgroundColor: colors.borderLight, borderRadius: borderRadius.full },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.max(clamped, 2)}%`,
              backgroundColor: barColor,
              borderRadius: borderRadius.full,
            },
          ]}
        />
      </View>
    );
  };

  const renderMetricRow = (item: QuotaMetricItem, showProgress = false) => {
    const isUnavailable = item.availability === 'unavailable';
    const warningColor = getWarningColor(item.warningLevel);

    return (
      <View
        key={item.metricName}
        style={[
          styles.metricBlock,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
            borderRadius: borderRadius.md,
          },
        ]}
      >
        <View style={styles.metricHeaderRow}>
          <View style={styles.metricTitleGroup}>
            <Text style={[styles.metricTitle, { color: colors.textPrimary }]}>
              {item.metricName}
            </Text>
            {item.availability === 'authoritative' ? (
              <Badge type="info" label="Verified" />
            ) : item.availability === 'estimated' ? (
              <Badge type="warning" label="Estimated" />
            ) : (
              <Badge type="neutral" label="Unavailable" />
            )}
          </View>

          <Text
            style={[
              styles.metricValueText,
              { color: isUnavailable ? colors.textMuted : warningColor },
            ]}
          >
            {item.formattedUsed}
          </Text>
        </View>

        {showProgress && !isUnavailable && item.percentageUsed !== undefined && (
          <View style={styles.progressContainer}>
            {renderProgressBar(item.percentageUsed, item.warningLevel)}
            <View style={styles.quotaLegendRow}>
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                {item.percentageUsed}% of {item.formattedLimit}
              </Text>
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                {item.formattedRemaining} left
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.explanationText, { color: colors.textMuted }]}>
          {item.explanation}
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <AppIcon
              family="material"
              name="cloud-circle"
              size={22}
              color={colors.primary}
            />
          </View>
          <View>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>
              Supabase Cloud Usage
            </Text>
            <Text style={[styles.subheading, { color: colors.textSecondary }]}>
              Plan: {report.planName}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleRefresh}
          disabled={isRefreshing}
          activeOpacity={0.7}
          style={[
            styles.refreshBtn,
            {
              backgroundColor: colors.borderLight,
              borderRadius: borderRadius.sm,
            },
          ]}
          accessibilityLabel="Refresh usage metrics"
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <AppIcon name="refresh-cw" size={14} color={colors.primary} />
              <Text style={[styles.refreshText, { color: colors.primary }]}>
                Refresh
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Warning banner if threshold reached */}
      {report.highestWarningLevel !== 'normal' && (
        <View
          style={[
            styles.warningBanner,
            {
              backgroundColor:
                report.highestWarningLevel === 'danger_95'
                  ? colors.dangerBg
                  : colors.warningBg,
              borderColor: getWarningColor(report.highestWarningLevel),
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <AppIcon
            family="material"
            name="alert-circle-outline"
            size={18}
            color={getWarningColor(report.highestWarningLevel)}
          />
          <View style={styles.warningTextContainer}>
            {report.warningMessages.map((msg, idx) => (
              <Text
                key={idx}
                style={[
                  styles.warningMessageText,
                  { color: getWarningColor(report.highestWarningLevel) },
                ]}
              >
                {msg}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Quota Metrics */}
      <View style={styles.metricsList}>
        {renderMetricRow(report.databaseStorage, true)}
        {renderMetricRow(report.fileStorage, true)}
        {renderMetricRow(report.networkEgress, false)}
        {renderMetricRow(report.activeUsers, false)}
      </View>

      {/* Backup Archive Sub-Card */}
      <View
        style={[
          styles.backupArchiveBlock,
          {
            backgroundColor: colors.background,
            borderColor: colors.borderLight,
            borderRadius: borderRadius.md,
          },
        ]}
      >
        <View style={styles.archiveRow}>
          <AppIcon family="material" name="archive-outline" size={16} color={colors.primary} />
          <Text style={[styles.archiveLabel, { color: colors.textPrimary }]}>
            Verified Snapshots Stored:
          </Text>
          <Text style={[styles.archiveValue, { color: colors.primary }]}>
            {report.backupStorage.totalBackups} ({report.backupStorage.formattedSize})
          </Text>
        </View>
        {report.lastRefreshedAt && (
          <Text style={[styles.lastRefreshedText, { color: colors.textMuted }]}>
            Last refreshed: {new Date(report.lastRefreshedAt).toLocaleTimeString()}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subheading: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '600',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningMessageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsList: {
    gap: 10,
  },
  metricBlock: {
    padding: 12,
    borderWidth: 1,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  metricValueText: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  progressTrack: {
    height: 6,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
  },
  quotaLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  explanationText: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 4,
    lineHeight: 15,
  },
  backupArchiveBlock: {
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
  },
  archiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  archiveLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  archiveValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  lastRefreshedText: {
    fontSize: 10,
    marginTop: 4,
  },
});
