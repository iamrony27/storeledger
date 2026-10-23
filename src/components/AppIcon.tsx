import React from 'react';
import { ColorValue, StyleProp, ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

export type IconFamily = 'feather' | 'material' | 'ionicons';

export interface AppIconProps {
  family?: IconFamily;
  name: string;
  size?: number;
  color?: ColorValue | string;
  style?: StyleProp<ViewStyle | any>;
}

export const AppIcon: React.FC<AppIconProps> = ({
  family = 'feather',
  name,
  size = 20,
  color = '#000000',
  style,
}) => {
  if (family === 'material') {
    return <MaterialCommunityIcons name={name as any} size={size} color={color} style={style} />;
  }
  if (family === 'ionicons') {
    return <Ionicons name={name as any} size={size} color={color} style={style} />;
  }
  return <Feather name={name as any} size={size} color={color} style={style} />;
};
