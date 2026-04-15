import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

export default function RoadmapScreen() {
  return (
    <View style={styles.wrap}>
      {/* @ts-ignore — iframe is valid on Expo web */}
      <iframe
        src="/admin-static/roadmap.html"
        style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
        title="Roadmap"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.bg },
});
