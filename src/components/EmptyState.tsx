import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon, IconFamily } from './AppIcon';
import { AppButton } from './AppButton';

interface EmptyStateProps {
  iconName: string;
  iconFamily?: IconFamily;
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  iconName,
  iconFamily = 'feather',
  title,
  description,
  actionTitle,
  onAction,
}) => {
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View style={[styles.container, { padding: spacing.xxl }]}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: colors.borderLight,
            borderColor: colors.border,
            borderRadius: borderRadius.full,
          },
        ]}
      >
        <AppIcon
          family={iconFamily}
          name={iconName}
          size={36}
          color={colors.textSecondary}
        />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {description}
      </Text>
      {actionTitle && onAction && (
        <View style={styles.actionContainer}>
          <AppButton
            title={actionTitle}
            onPress={onAction}
            iconName="plus"
            size="md"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  actionContainer: {
    marginTop: 18,
  },
});
