import React from 'react';
import { ColorValue } from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

export type IconFamily = 'feather' | 'material' | 'ionicons';

interface AppIconProps {
  family?: IconFamily;
  name: string;
  size?: number;
  color?: ColorValue | string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  family = 'feather',
  name,
  size = 20,
  color = '#000000',
}) => {
  if (family === 'material') {
    return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
  }
  if (family === 'ionicons') {
    return <Ionicons name={name as any} size={size} color={color} />;
  }
  return <Feather name={name as any} size={size} color={color} />;
};
