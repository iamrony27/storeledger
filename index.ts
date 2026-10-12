import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import React from 'react';

// Explicitly provide route context directory using standard JS createElement
export function App() {
  // @ts-ignore require.context is provided by Metro bundler at build time
  const ctx = require.context('./src/app');
  return React.createElement(ExpoRoot, { context: ctx });
}

registerRootComponent(App);
