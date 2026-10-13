import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon, IconFamily } from './AppIcon';

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  iconName?: string;
  iconFamily?: IconFamily;
  prefixText?: string;
  onClear?: () => void;
  containerStyle?: ViewStyle;
}

export const AppTextInput = React.forwardRef<TextInput, AppTextInputProps>((
  {
    label,
    error,
    iconName,
    iconFamily = 'feather',
    prefixText,
    onClear,
    containerStyle,
    value,
    ...rest
  },
  ref
) => {
  const { colors, borderRadius, spacing, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : isFocused
    ? colors.primary
    : colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.inputBg,
            borderColor,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        {iconName && (
          <View style={styles.iconContainer}>
            <AppIcon
              family={iconFamily}
              name={iconName}
              size={18}
              color={isFocused ? colors.primary : colors.textSecondary}
            />
          </View>
        )}
        {prefixText && (
          <View style={styles.prefixContainer}>
            <Text
              style={[
                styles.prefixText,
                { color: isFocused ? colors.primary : colors.textPrimary },
              ]}
            >
              {prefixText}
            </Text>
          </View>
        )}
        <TextInput
          ref={ref}
          accessibilityLabel={label || rest.placeholder}
          {...rest}
          value={value}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            typography.body,
            { color: colors.textPrimary },
          ]}
        />
        {onClear && value && value.length > 0 ? (
          <TouchableOpacity
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear input"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppIcon name="x" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error && (
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {error}
        </Text>
      )}
    </View>
  );
});

AppTextInput.displayName = 'AppTextInput';

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    height: 48,
  },
  iconContainer: {
    marginRight: 10,
  },
  prefixContainer: {
    marginRight: 6,
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: 18,
    fontWeight: '800',
  },
  input: {
    flex: 1,
    height: '100%',
    padding: 0,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});
