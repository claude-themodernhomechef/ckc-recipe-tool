// ─────────────────────────────────────────────
//  RecipeDetailScreen — placeholder
//  Full recipe detail view to be built in a later phase.
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Colors, Fonts } from '../constants/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RecipeDetail'>;
  route: RouteProp<RootStackParamList, 'RecipeDetail'>;
};

export default function RecipeDetailScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.body}>
        <Text style={styles.title}>Recipe Detail</Text>
        <Text style={styles.subtitle}>Coming soon.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  back: { padding: 20 },
  backText: { fontFamily: Fonts.body, fontSize: 15, color: Colors.textSecondary },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontFamily: Fonts.body, fontSize: 15, color: Colors.textSecondary },
});
