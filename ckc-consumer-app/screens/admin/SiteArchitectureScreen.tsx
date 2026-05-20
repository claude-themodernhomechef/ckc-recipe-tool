/**
 * SiteArchitectureScreen
 *
 * Renders the interactive architecture map (public/admin-static/architecture-map.html)
 * inside an iframe on web. On native, shows a "web only" notice.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

export default function SiteArchitectureScreen() {
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Site Architecture</Text>
        <Text style={styles.fallbackText}>
          Open the admin on desktop web to view the interactive architecture map.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* @ts-ignore — iframe is a web-only element */}
      <iframe
        src="/admin-static/architecture-map.html"
        title="CKC Site Architecture"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.bg },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.bg,
  },
  fallbackTitle: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  fallbackText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 360,
  },
});
