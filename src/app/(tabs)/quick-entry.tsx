import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { QuickTransactionModal } from '../../components/QuickTransactionModal';

export default function QuickEntryScreen() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(true);

  const handleClose = () => {
    setVisible(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSuccess = (customerId: string) => {
    setVisible(false);
    router.replace(`/customer/${customerId}` as any);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <QuickTransactionModal
        visible={visible}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
