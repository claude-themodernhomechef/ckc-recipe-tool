/**
 * NeedsReviewScreen
 *
 * Admin tool for resolving uncertain diet tags flagged during enrichment.
 * Data source: `reviewItems` array on recipe docs (processingStatus === 'pending_review').
 *
 * Decision flow:
 *   Compliant  → dietTag native: true, uncertain: false
 *   Replace    → Claude generates swap note → editable text box → Approve → dietTag mod: true
 *   Remove     → dietTag native: false, mod: false, uncertain: false
 *   Skip       → no change, move on
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
  Image,
} from 'react-native';
import { Colors, Fonts } from '../../constants/theme';
import {
  fetchNeedsReviewRecipes,
  resolveReviewItem,
  NeedsReviewRecipe,
  ReviewItem,
} from '../../lib/firestore';

// ── Claude swap-note generator ────────────────────────────────────────────────

const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

const STYLE_EXAMPLES = `
Examples of the correct note style:

Replace 3 garlic cloves and 1/3 cup of the olive oil with 3 tablespoons garlic-infused oil. Use the remaining olive oil (approximately 1 tablespoon) as needed for consistency.

Replace shallots and garlic cloves with 2 tablespoons garlic-infused oil (mixed into the glaze). The ginger, rice vinegar, bok choy, pork, orange juice, and brown sugar are all LF-compliant. Omit the whole orange halves from the pan to avoid consuming the high-FODMAP solids.

Remove black pepper entirely. Remove dijon mustard entirely (fermented, high-histamine). Remove or reduce parmesan (aged cheese, high-histamine). Lemon can remain in moderate amounts. Recipe is otherwise low-histamine compliant with these removals.

Replace 1 cup white rice with 1 cup cauliflower rice. Replace warm pita or naan with butter lettuce or iceberg lettuce wraps. All other ingredients remain unchanged.

Replace 60ml milk with 60ml unsweetened oat milk or full-fat canned coconut milk. Replace 20g butter with 20g olive oil or dairy-free butter.

Replace all-purpose flour with a 1:1 GF flour blend. Replace flour tortillas with corn tortillas or a GF variety.
`;

const SYSTEM_PROMPT = `You rewrite diet compliance modification notes for recipes.

Style rules:
- Imperative sentences: "Replace X with Y.", "Remove X entirely.", "Use X instead of Y."
- Specific quantities when known (e.g., "Replace 2 garlic cloves with 1 tbsp garlic-infused oil")
- Note what stays compliant when helpful: "All other ingredients are LF-compliant."
- Multiple swaps as separate sentences in a flowing paragraph
- No bullet points, no headers, no markdown
- No mention of diet protocol names within the note text
- End with a period

${STYLE_EXAMPLES}

You will be given a flagged ingredient and the reason it was flagged. Write a modification note instructing how to swap or remove it to make the recipe compliant. Keep it concise and specific.`;

async function generateSwapNote(
  recipeName: string,
  protocol: string,
  ingredient: string,
  reason: string,
  existingNote?: string,
): Promise<string> {
  const userMessage = [
    `Recipe: ${recipeName}`,
    `Protocol: ${protocol}`,
    `Flagged ingredient: ${ingredient}`,
    `Reason flagged: ${reason}`,
    existingNote ? `Existing note (if any): ${existingNote}` : '',
    '',
    'Write a modification note for this ingredient swap/removal:',
  ].filter(Boolean).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':         'application/json',
      'x-api-key':            ANTHROPIC_KEY,
      'anthropic-version':    '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 400,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  return (data.content?.[0]?.text ?? '').trim();
}

// ── Protocol badge colors ─────────────────────────────────────────────────────

const PROTO_COLORS: Record<string, string> = {
  GF:  Colors.diet.GF,
  DF:  Colors.diet.DF,
  K:   Colors.diet.K,
  LF:  Colors.diet.LF,
  V:   Colors.diet.V,
  Vg:  Colors.diet.Vg,
  AIP: Colors.diet.AIP,
  LH:  Colors.diet.LH,
};

const CATEGORY_LABELS: Record<string, string> = {
  grey_area:          'Grey area',
  no_product_found:   'No product found',
  needs_clarification:'Needs clarification',
};

// ── Types ─────────────────────────────────────────────────────────────────────

type DecisionState =
  | { type: 'idle' }
  | { type: 'generating' }
  | { type: 'replace_ready'; note: string }
  | { type: 'saving' }
  | { type: 'done'; decision: string };

// ── Single review item card ───────────────────────────────────────────────────

interface ReviewCardProps {
  item:       ReviewItem;
  recipe:     NeedsReviewRecipe;
  onResolved: () => void;
}

function ReviewCard({ item, recipe, onResolved }: ReviewCardProps) {
  const [state, setState] = useState<DecisionState>({ type: 'idle' });
  const [noteText, setNoteText] = useState('');

  const existingNote = (recipe.dietTags[item.protocol]?.notes as string) || '';

  async function handleReplace() {
    setState({ type: 'generating' });
    try {
      const note = await generateSwapNote(
        recipe.name,
        item.protocol,
        item.ingredient,
        item.reason,
        existingNote,
      );
      setNoteText(note);
      setState({ type: 'replace_ready', note });
    } catch (e) {
      console.warn('generateSwapNote failed:', e);
      setNoteText(existingNote || '');
      setState({ type: 'replace_ready', note: existingNote || '' });
    }
  }

  async function handleDecision(decision: 'compliant' | 'remove' | 'skip') {
    setState({ type: 'saving' });
    try {
      await resolveReviewItem(
        recipe.id,
        item.protocol,
        item.ingredient,
        decision,
        recipe.dietTags,
        recipe.reviewItems,
      );
      setState({ type: 'done', decision });
      onResolved();
    } catch (e) {
      console.warn('resolveReviewItem failed:', e);
      setState({ type: 'idle' });
    }
  }

  async function handleApproveSwap() {
    setState({ type: 'saving' });
    try {
      await resolveReviewItem(
        recipe.id,
        item.protocol,
        item.ingredient,
        'replace',
        recipe.dietTags,
        recipe.reviewItems,
        noteText,
      );
      setState({ type: 'done', decision: 'replace' });
      onResolved();
    } catch (e) {
      console.warn('resolveReviewItem failed:', e);
      setState({ type: 'replace_ready', note: noteText });
    }
  }

  const protocolColor = PROTO_COLORS[item.protocol] || Colors.textMuted;
  const isDone = state.type === 'done';

  return (
    <View style={[styles.card, isDone && styles.cardDone]}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={[styles.protoBadge, { backgroundColor: protocolColor + '22', borderColor: protocolColor }]}>
          <Text style={[styles.protoBadgeText, { color: protocolColor }]}>{item.protocol}</Text>
        </View>
        <Text style={styles.ingredientText}>{item.ingredient}</Text>
        {item.category ? (
          <View style={styles.categoryTag}>
            <Text style={styles.categoryText}>{CATEGORY_LABELS[item.category] || item.category}</Text>
          </View>
        ) : null}
      </View>

      {/* Reason */}
      <Text style={styles.reasonText}>{item.reason}</Text>

      {/* Caution products from FIG */}
      {item.caution ? (
        <Text style={styles.cautionText}>
          FIG caution products: {item.caution}
        </Text>
      ) : null}

      {/* Done state */}
      {isDone ? (
        <View style={styles.doneRow}>
          <Text style={styles.doneText}>
            {state.decision === 'compliant' ? '✓ Marked compliant'
              : state.decision === 'replace'  ? '✓ Swap saved'
              : state.decision === 'remove'   ? '✓ Tag removed'
              : '→ Skipped'}
          </Text>
        </View>
      ) : state.type === 'generating' ? (
        <View style={styles.generatingRow}>
          <ActivityIndicator size="small" color={Colors.gold} />
          <Text style={styles.generatingText}>Generating swap note…</Text>
        </View>
      ) : state.type === 'replace_ready' ? (
        <View style={styles.swapBox}>
          <TextInput
            style={styles.swapInput}
            value={noteText}
            onChangeText={setNoteText}
            multiline
            placeholder="Swap note…"
            placeholderTextColor={Colors.textMuted}
          />
          <View style={styles.swapActions}>
            <TouchableOpacity style={styles.approveBtn} onPress={handleApproveSwap}>
              {state.type === 'saving' as unknown
                ? <ActivityIndicator size="small" color={Colors.bg} />
                : <Text style={styles.approveBtnText}>Approve</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setState({ type: 'idle' })}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.decisionRow}>
          <TouchableOpacity
            style={[styles.decBtn, styles.decBtnCompliant]}
            onPress={() => handleDecision('compliant')}
            disabled={state.type === 'saving'}
          >
            <Text style={styles.decBtnText}>Compliant</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.decBtn, styles.decBtnReplace]}
            onPress={handleReplace}
            disabled={state.type === 'saving'}
          >
            <Text style={styles.decBtnText}>Replace</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.decBtn, styles.decBtnRemove]}
            onPress={() => handleDecision('remove')}
            disabled={state.type === 'saving'}
          >
            <Text style={styles.decBtnText}>Remove Tag</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.decBtn, styles.decBtnSkip]}
            onPress={() => handleDecision('skip')}
            disabled={state.type === 'saving'}
          >
            <Text style={styles.decBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function NeedsReviewScreen() {
  const { width } = useWindowDimensions();
  const isMobile  = width < 700;

  const [recipes, setRecipes]         = useState<NeedsReviewRecipe[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [showDetail, setShowDetail]   = useState(false); // mobile only

  useEffect(() => {
    fetchNeedsReviewRecipes().then(data => {
      setRecipes(data);
      if (data.length > 0 && !isMobile) setSelectedId(data[0].id);
      setLoading(false);
    });
  }, []);

  const selected = recipes.find(r => r.id === selectedId) ?? null;

  // Count unresolved items per recipe
  function unresolvedCount(r: NeedsReviewRecipe) {
    return r.reviewItems.filter(i => !i.resolved).length;
  }

  const totalUnresolved = recipes.reduce((n, r) => n + unresolvedCount(r), 0);
  const totalRecipes    = recipes.length;

  // Called when a decision is saved — refresh local state
  const handleResolved = useCallback(() => {
    fetchNeedsReviewRecipes().then(data => {
      setRecipes(data);
      // If selected recipe is now fully resolved, move to next
      if (selectedId) {
        const still = data.find(r => r.id === selectedId);
        if (!still) {
          const next = data[0] ?? null;
          setSelectedId(next?.id ?? null);
        }
      }
    });
  }, [selectedId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.textMuted} />
      </View>
    );
  }

  if (recipes.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>All clear</Text>
        <Text style={styles.emptyBody}>No recipes pending review.</Text>
      </View>
    );
  }

  // ── Mobile: show list or detail ────────────────────────────────────────────
  if (isMobile) {
    if (showDetail && selected) {
      const unresolved = selected.reviewItems.filter(i => !i.resolved);
      return (
        <View style={{ flex: 1, backgroundColor: Colors.bg }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setShowDetail(false)}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.detailScroll}>
            <Text style={styles.detailTitle}>{selected.name}</Text>
            {unresolved.map((item, i) => (
              <ReviewCard key={`${item.protocol}-${i}`} item={item} recipe={selected} onResolved={handleResolved} />
            ))}
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <View style={styles.statsBar}>
          <Text style={styles.statItem}><Text style={styles.statNum}>{totalRecipes}</Text> recipes</Text>
          <Text style={styles.statItem}><Text style={[styles.statNum, { color: Colors.gold }]}>{totalUnresolved}</Text> flags remaining</Text>
        </View>
        <FlatList
          data={recipes}
          keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.sidebarItem}
              onPress={() => { setSelectedId(item.id); setShowDetail(true); }}
            >
              <Text style={styles.sidebarName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.sidebarBadge}>
                <Text style={styles.sidebarBadgeText}>{unresolvedCount(item)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // ── Desktop: two-panel layout ──────────────────────────────────────────────
  const unresolved = selected ? selected.reviewItems.filter(i => !i.resolved) : [];

  return (
    <View style={styles.layout}>

      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.statsBar}>
          <Text style={styles.statItem}><Text style={styles.statNum}>{totalRecipes}</Text> recipes</Text>
          <Text style={styles.statItem}><Text style={[styles.statNum, { color: Colors.gold }]}>{totalUnresolved}</Text> flags</Text>
        </View>
        <FlatList
          data={recipes}
          keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.sidebarItem, item.id === selectedId && styles.sidebarItemActive]}
              onPress={() => setSelectedId(item.id)}
            >
              <Text style={[styles.sidebarName, item.id === selectedId && styles.sidebarNameActive]} numberOfLines={2}>
                {item.name}
              </Text>
              <View style={[styles.sidebarBadge, item.id === selectedId && styles.sidebarBadgeActive]}>
                <Text style={styles.sidebarBadgeText}>{unresolvedCount(item)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Detail panel */}
      <ScrollView style={styles.detail} contentContainerStyle={styles.detailScroll}>
        {selected ? (
          <>
            <View style={styles.detailHeader}>
              {selected.image ? (
                <Image source={{ uri: selected.image }} style={styles.detailThumb} />
              ) : (
                <View style={[styles.detailThumb, { backgroundColor: selected.placeholder_color }]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.detailTitle}>{selected.name}</Text>
                <Text style={styles.detailMeta}>{unresolved.length} flag{unresolved.length !== 1 ? 's' : ''} to resolve</Text>
              </View>
            </View>

            {unresolved.map((item, i) => (
              <ReviewCard
                key={`${item.protocol}-${item.ingredient}-${i}`}
                item={item}
                recipe={selected}
                onResolved={handleResolved}
              />
            ))}
          </>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyBody}>Select a recipe from the list.</Text>
          </View>
        )}
      </ScrollView>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },

  emptyTitle: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary, marginBottom: 8 },
  emptyBody:  { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },

  // Two-panel desktop layout
  layout:  { flex: 1, flexDirection: 'row', backgroundColor: Colors.bg },

  // Sidebar
  sidebar: { width: 300, borderRightWidth: 1, borderRightColor: Colors.border },

  statsBar: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statItem: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },
  statNum:  { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },

  sidebarItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 8,
  },
  sidebarItemActive: { backgroundColor: Colors.surface },
  sidebarName:       { flex: 1, fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary },
  sidebarNameActive: { color: Colors.textPrimary },
  sidebarBadge:      {
    backgroundColor: Colors.gold + '22',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  sidebarBadgeActive: { backgroundColor: Colors.gold + '44' },
  sidebarBadgeText:   { fontFamily: Fonts.bodyMedium, fontSize: 11, color: Colors.gold },

  // Detail panel
  detail:       { flex: 1 },
  detailScroll: { padding: 24, gap: 16 },

  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  detailThumb:  { width: 64, height: 64, borderRadius: 8 },
  detailTitle:  { fontFamily: Fonts.display, fontSize: 22, color: Colors.textPrimary, marginBottom: 2 },
  detailMeta:   { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },

  // Review card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
  },
  cardDone: { opacity: 0.5 },

  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  protoBadge:    { borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  protoBadgeText:{ fontFamily: Fonts.bodyMedium, fontSize: 11 },
  ingredientText:{ fontFamily: Fonts.bodyMedium, fontSize: 15, color: Colors.textPrimary, flex: 1 },
  categoryTag:   { backgroundColor: Colors.surfaceElevated, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  categoryText:  { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },

  reasonText:  { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  cautionText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.gold, lineHeight: 18 },

  // Decision buttons
  decisionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  decBtn:      {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6,
    borderWidth: 1,
  },
  decBtnCompliant: { borderColor: Colors.green,    backgroundColor: Colors.green    + '18' },
  decBtnReplace:   { borderColor: Colors.gold,     backgroundColor: Colors.gold     + '18' },
  decBtnRemove:    { borderColor: Colors.red,      backgroundColor: Colors.red      + '18' },
  decBtnSkip:      { borderColor: Colors.border,   backgroundColor: Colors.surface },
  decBtnText:      { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textPrimary },

  // Replace flow
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  generatingText:{ fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },

  swapBox: { gap: 10, marginTop: 4 },
  swapInput: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.borderActive,
    borderRadius: 8, padding: 12,
    fontFamily: Fonts.body, fontSize: 13, color: Colors.textPrimary,
    minHeight: 100, textAlignVertical: 'top',
  },
  swapActions:   { flexDirection: 'row', gap: 8 },
  approveBtn:    {
    flex: 1, backgroundColor: Colors.green, borderRadius: 6,
    paddingVertical: 10, alignItems: 'center',
  },
  approveBtnText:{ fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.bg },
  cancelBtn:     {
    paddingHorizontal: 16, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 10, alignItems: 'center',
  },
  cancelBtnText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },

  // Done state
  doneRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  doneText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.green },

  // Mobile back button
  backBtn:     { paddingHorizontal: 16, paddingVertical: 12 },
  backBtnText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary },
});
