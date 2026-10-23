import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './AppIcon';

interface TransactionDatePickerProps {
  date: string; // ISO string
  onDateChange: (newDateIso: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const TransactionDatePicker: React.FC<TransactionDatePickerProps> = ({
  date,
  onDateChange,
}) => {
  const { colors, borderRadius, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const parsedDate = date ? new Date(date) : new Date();
  const [viewYear, setViewYear] = useState(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth());
  const [selectedDay, setSelectedDay] = useState(parsedDate.getDate());

  const isToday = (d: Date) => {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const isYesterday = (d: Date) => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return (
      d.getDate() === y.getDate() &&
      d.getMonth() === y.getMonth() &&
      d.getFullYear() === y.getFullYear()
    );
  };

  const setToday = () => {
    const now = new Date();
    onDateChange(now.toISOString());
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDay(now.getDate());
  };

  const setYesterday = () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    onDateChange(y.toISOString());
    setViewYear(y.getFullYear());
    setViewMonth(y.getMonth());
    setSelectedDay(y.getDate());
  };

  const openCustomPicker = () => {
    const curr = date ? new Date(date) : new Date();
    setViewYear(curr.getFullYear());
    setViewMonth(curr.getMonth());
    setSelectedDay(curr.getDate());
    setModalVisible(true);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOffset = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleConfirmDate = () => {
    const newDate = new Date(viewYear, viewMonth, selectedDay, 12, 0, 0);
    onDateChange(newDate.toISOString());
    setModalVisible(false);
  };

  const daysCount = getDaysInMonth(viewYear, viewMonth);
  const firstDayOffset = getFirstDayOffset(viewYear, viewMonth);
  const calendarCells: (number | null)[] = [];

  for (let i = 0; i < firstDayOffset; i++) {
    calendarCells.push(null);
  }
  for (let i = 1; i <= daysCount; i++) {
    calendarCells.push(i);
  }

  const formattedDisplay = parsedDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const currentlyToday = isToday(parsedDate);
  const currentlyYesterday = isYesterday(parsedDate);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        TRANSACTION DATE
      </Text>

      {/* Quick Selection Chips */}
      <View style={styles.chipsRow}>
        <TouchableOpacity
          onPress={setToday}
          style={[
            styles.chip,
            {
              backgroundColor: currentlyToday ? colors.primary : (isDark ? 'rgba(255,255,255,0.06)' : colors.inputBg),
              borderColor: currentlyToday ? colors.primary : (isDark ? 'rgba(255,255,255,0.1)' : colors.border),
              borderRadius: 10,
            },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: currentlyToday ? '#FFFFFF' : colors.textPrimary },
            ]}
          >
            Today
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={setYesterday}
          style={[
            styles.chip,
            {
              backgroundColor: currentlyYesterday
                ? colors.primary
                : (isDark ? 'rgba(255,255,255,0.06)' : colors.inputBg),
              borderColor: currentlyYesterday ? colors.primary : (isDark ? 'rgba(255,255,255,0.1)' : colors.border),
              borderRadius: 10,
            },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: currentlyYesterday ? '#FFFFFF' : colors.textPrimary },
            ]}
          >
            Yesterday
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={openCustomPicker}
          style={[
            styles.chipCustom,
            {
              backgroundColor:
                !currentlyToday && !currentlyYesterday
                  ? colors.primaryLight
                  : (isDark ? 'rgba(255,255,255,0.06)' : colors.inputBg),
              borderColor:
                !currentlyToday && !currentlyYesterday
                  ? colors.primary
                  : (isDark ? 'rgba(255,255,255,0.1)' : colors.border),
              borderRadius: 10,
            },
          ]}
        >
          <AppIcon
            name="calendar"
            size={14}
            color={
              !currentlyToday && !currentlyYesterday
                ? colors.primary
                : colors.textSecondary
            }
          />
          <Text
            style={[
              styles.chipText,
              {
                color:
                  !currentlyToday && !currentlyYesterday
                    ? colors.primary
                    : colors.textPrimary,
                fontWeight: '700',
              },
            ]}
          >
            {formattedDisplay}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Calendar Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.calendarCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: 24,
              },
            ]}
          >
            {/* Header: Month & Year Navigator */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.navBtn}
              >
                <AppIcon name="chevron-left" size={20} color={colors.textPrimary} />
              </TouchableOpacity>

              <Text style={[styles.monthYearTitle, { color: colors.textPrimary }]}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>

              <TouchableOpacity
                onPress={handleNextMonth}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.navBtn}
              >
                <AppIcon name="chevron-right" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Day of Week Labels */}
            <View style={styles.daysHeaderRow}>
              {DAY_LABELS.map((day, idx) => (
                <Text
                  key={idx}
                  style={[styles.dayHeaderCell, { color: colors.textSecondary }]}
                >
                  {day}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {calendarCells.map((dayNum, idx) => {
                if (dayNum === null) {
                  return <View key={idx} style={styles.emptyDayCell} />;
                }
                const isSelected = selectedDay === dayNum;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setSelectedDay(dayNum)}
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : 'transparent',
                        borderRadius: borderRadius.sm,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayCellText,
                        {
                          color: isSelected ? '#FFFFFF' : colors.textPrimary,
                          fontWeight: isSelected ? '800' : '500',
                        },
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[
                  styles.cancelBtn,
                  {
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.border,
                    borderRadius: 12,
                  },
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmDate}
                style={[
                  styles.confirmBtn,
                  { backgroundColor: colors.primary, borderRadius: 12 },
                ]}
              >
                <Text style={styles.confirmBtnText}>Set Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipCustom: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 340,
    padding: 20,
    borderWidth: 1,
    borderRadius: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    padding: 6,
  },
  monthYearTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  daysHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayHeaderCell: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  emptyDayCell: {
    width: '14.28%',
    height: 38,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellText: {
    fontSize: 14,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
