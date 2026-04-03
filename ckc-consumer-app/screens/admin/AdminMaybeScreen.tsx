/**
 * AdminMaybeScreen
 *
 * List view of status:"maybe" recipes.
 * Tap Approve or Reject on each card to make a final decision.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Colors, Fonts } from '../../constants/theme';
import { fetchMaybeRecipes, updateRecipeStatus } from '../../lib/firestore';
import { Recipe, getComplianceStatus } from '../../data/sampleRecipes';
import DietTag from '../components/DietTag';

const DIET_PROTOCOLS = ['GF', 'DF', 'LF', 'K', 'AIP', 'V', 'Vg', 'LH'];

function MaybeCard({ recipe, onDecide }: { recipe: Recipe; onDecide: (status: 'yes' | 'no') => void }) {
  return (
    <View style={styles.card}>
      {/* Thumbnail */}
      <View style={[styles.thumb, { backgroundColor: recipe.placeholder_color }]}>
        {recipe.photo_url ? (
          <Image source={{ uri: recipe.photo_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : null}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{recipe.name}</Text>
        <Text style={styles.meta}>{recipe.cuisine}  ·  {recipe.protein_type}</Text>
        {recipe.blogger ? <Text style={styles.blogger}>{recipe.blogger}</Text> : null}
        {(() => {
          const tags = DIET_PROTOCOLS
            .map(p => ({ p, status: getComplianceStatus(recipe, p) }))
            .filter(t => t.status !== 'none')
            .sort((a, b) => {
              if (a.status !== b.status) return a.status === 'native' ? -1 : 1;
              return a.p.localeCompare(b.p);
            });
          return tags.length > 0 ? (
            <View style={styles.dietRow}>
              {tags.map(t => (
                <DietTag key={t.p} protocol={t.p} variant="circle" status={t.status === 'modified' ? 'modified' : 'native'} />
              ))}
            </View>
          ) : null;
        })()}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => onDecide('yes')}>
          <Text style={styles.btnText}>✓</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={() => onDecide('no')}>
          <Text style={styles.btnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AdminMaybeScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchMaybeRecipes().then((r) => { setRecipes(r); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDecide(recipe: Recipe, status: 'yes' | 'no') {
    try {
      await updateRecipeStatus(recipe.id, status);
      setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    } catch (e) {
      console.warn('Status update failed:', e);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.textSecondary} />
      </View>
    );
  }

  if (recipes.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Maybe queue is empty</Text>
        <TouchableOpacity style={styles.reloadBtn} onPress={load}>
          <Text style={styles.reloadBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={recipes}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: Colors.bg }}
      renderItem={({ item }) => (
        <MaybeCard recipe={item} onDecide={(s) => handleDecide(item, s)} />
      )}
      ListHeaderComponent={
        <Text style={styles.header}>{recipes.length} deferred</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  list:     { padding: 16, paddingBottom: 40, backgroundColor: Colors.bg },
  header:   { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginBottom: 12 },

  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumb: { width: 80, height: 80 },
  info: { flex: 1, padding: 10, justifyContent: 'center' },
  name: { fontFamily: Fonts.display, fontSize: 16, color: Colors.textPrimary, marginBottom: 2 },
  meta: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  blogger: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  dietRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },

  actions: { flexDirection: 'column', justifyContent: 'center', gap: 6, paddingRight: 10 },
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  btnApprove: { backgroundColor: Colors.green },
  btnReject:  { backgroundColor: Colors.red },
  btnText: { fontSize: 16, color: Colors.textPrimary },

  emptyTitle:   { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary, marginBottom: 16 },
  reloadBtn:    { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  reloadBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textSecondary },
});
