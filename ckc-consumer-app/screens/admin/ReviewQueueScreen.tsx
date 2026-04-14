/**
 * ReviewQueueScreen — rebuilt
 *
 * Layout mirrors the admin shopping / catalog view:
 *   LEFT   Filtered recipe list with diet token circles + search + filters
 *   RIGHT  Recipe card (editable) + diet filter row + shopping list + collapsible edit section
 *
 * Replaces both Shopping List and Needs Review admin tabs (those can be removed after).
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList,
  Image, ActivityIndicator, Alert, StyleSheet, Modal, Pressable, Linking,
} from 'react-native';
import { parseIngredient, fmtQty, SHOPPING_CATEGORIES, categorizeIngredientWithMatch, addIngredientToDb } from '../../lib/ingredientParser';
import {
  collection, query, where, getDocs, doc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { resolveReviewItem, ReviewItem } from '../../lib/firestore';
import { Colors, Fonts } from '../../constants/theme';
import DietTag, { DIET_COLORS } from '../components/DietTag';

// ── AI swap note generator (same as NeedsReviewScreen) ────────────────────────

const ANTHROPIC_KEY = (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY) ?? '';

const SWAP_SYSTEM_PROMPT = `You write diet compliance modification notes for recipes.

Style rules:
- Imperative sentences only: "Replace X with Y.", "Remove X entirely.", "Use X instead of Y."
- Specific quantities when known (e.g., "Replace 2 garlic cloves with 1 tbsp garlic-infused oil")
- Only describe the swap or removal — nothing else
- Do NOT explain why the swap works or describe the science behind it
- Do NOT list ingredients that are already compliant
- Do NOT say "all other ingredients are compliant" or anything similar
- No em dashes (—) anywhere in the note
- Multiple swaps as separate sentences in a flowing paragraph
- No bullet points, no headers, no markdown
- No mention of diet protocol names within the note text
- End with a period`;

async function generateSwapNote(
  recipeName: string,
  protocol: string,
  ingredient: string,
  reason: string,
  existingNote?: string,
): Promise<string> {
  const body = [
    `Recipe: ${recipeName}`,
    `Protocol: ${protocol}`,
    `Flagged ingredient: ${ingredient}`,
    `Reason flagged: ${reason}`,
    existingNote ? `Existing note: ${existingNote}` : '',
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
      system:     SWAP_SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: body }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json();
  return (data.content?.[0]?.text ?? '').trim();
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DIETS = ['AIP', 'LF', 'LH', 'K', 'GF', 'DF', 'V', 'Vg'] as const;
type DietCode = typeof DIETS[number];

const PROTEINS = [
  'Chicken', 'Beef', 'Fish', 'Seafood', 'Pork', 'Lamb',
  'Vegetarian', 'Tofu', 'Pasta', 'Vegetable',
];

// ── Types ─────────────────────────────────────────────────────────────────────

type DietState = 'native' | 'mod' | 'none';

interface DietTagData {
  native?: boolean;
  mod?:    boolean;
  notes?:  string;
}

interface RecipeDoc {
  _id:               string;
  name?:             string;
  url?:              string;
  image?:            string;
  blogger?:          string;
  cuisine?:          string;
  course?:           string;
  protein?:          string;
  rating?:           string;
  servings?:         string | number;
  ingredients?:             string[];
  ingredientNameOverrides?: Record<string, { name?: string; qty?: string }>; // raw → display overrides
  chefNotes?:               string;
  dietTags?:                Record<string, DietTagData>;
  reviewItems?:             ReviewItem[];
  processingStatus?:        string;
  _approved?:               boolean;
}

function getDietState(tag?: DietTagData): DietState {
  if (!tag) return 'none';
  if (tag.native) return 'native';
  if (tag.mod)    return 'mod';
  return 'none';
}

// ── Diet filter chip (left sidebar filter + right panel circles) ───────────────

function DietChip({
  code, active, tagState, onPress,
}: {
  code: string; active: boolean; tagState?: DietState; onPress: () => void;
}) {
  const color = (DIET_COLORS as Record<string, string>)[code] ?? Colors.textMuted;
  const isMod = tagState === 'mod';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        chip.circle,
        { borderColor: color },
        active ? { backgroundColor: color } : { backgroundColor: color + '20' },
        isMod && !active && chip.circleMod,
      ]}
    >
      <Text style={[chip.text, { color: active ? Colors.bg : color }]}>{code}</Text>
    </TouchableOpacity>
  );
}

const chip = StyleSheet.create({
  circle:    { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  circleMod: { borderStyle: 'dashed' as any },
  text:      { fontFamily: Fonts.bodyMedium, fontSize: 9, letterSpacing: 0.3 },
});

// ── Dropdown ──────────────────────────────────────────────────────────────────

function Dropdown({ label, value, options, onSelect }: {
  label: string; value: string; options: string[]; onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = Boolean(value);
  return (
    <View>
      <TouchableOpacity
        style={[dd.btn, isActive && dd.btnActive]}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
      >
        <Text style={[dd.text, isActive && dd.textActive]} numberOfLines={1}>{value || label}</Text>
        <Text style={dd.arrow}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={dd.backdrop} onPress={() => setOpen(false)}>
          <View style={dd.sheet}>
            <View style={dd.sheetHeader}>
              <Text style={dd.sheetTitle}>{label}</Text>
              {value ? (
                <TouchableOpacity onPress={() => { onSelect(''); setOpen(false); }}>
                  <Text style={dd.clear}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <FlatList
              data={options}
              keyExtractor={o => o}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[dd.option, item === value && dd.optionActive]}
                  onPress={() => { onSelect(item); setOpen(false); }}
                >
                  <Text style={[dd.optionText, item === value && dd.optionTextActive]}>{item}</Text>
                  {item === value && <Text style={dd.check}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const dd = StyleSheet.create({
  btn:             { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  btnActive:       { borderColor: Colors.borderActive, backgroundColor: Colors.surfaceElevated },
  text:            { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, maxWidth: 90 },
  textActive:      { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
  arrow:           { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  backdrop:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: Colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 32, maxHeight: 480 },
  sheetHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetTitle:      { fontFamily: Fonts.display, fontSize: 18, color: Colors.textPrimary },
  clear:           { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textSecondary },
  option:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  optionActive:    { backgroundColor: Colors.surfaceElevated },
  optionText:      { fontFamily: Fonts.body, fontSize: 15, color: Colors.textSecondary },
  optionTextActive:{ fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
  check:           { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.green },
});

// ── Recipe list row ───────────────────────────────────────────────────────────

function RecipeRow({
  recipe, selected, approved, onSelect,
}: {
  recipe: RecipeDoc; selected: boolean; approved: boolean; onSelect: () => void;
}) {
  const activeTags = DIETS.filter(code =>
    recipe.dietTags?.[code]?.native || recipe.dietTags?.[code]?.mod
  );

  return (
    <TouchableOpacity
      style={[rr.wrap, selected && rr.wrapSelected, approved && rr.wrapApproved]}
      onPress={onSelect}
      activeOpacity={0.75}
    >
      {recipe.image
        ? <Image source={{ uri: recipe.image }} style={rr.thumb} />
        : <View style={[rr.thumb, rr.thumbPlaceholder]} />}

      <View style={rr.info}>
        <Text style={[rr.name, selected && rr.nameSelected, approved && rr.nameApproved]} numberOfLines={2}>
          {recipe.name || 'Untitled'}
        </Text>
        <Text style={rr.meta} numberOfLines={1}>
          {[recipe.protein, recipe.blogger].filter(Boolean).join('  ·  ')}
        </Text>
        {activeTags.length > 0 && (
          <View style={rr.tags}>
            {activeTags.map(code => (
              <DietTag
                key={code}
                protocol={code}
                variant="circle"
                status={recipe.dietTags?.[code]?.native ? 'native' : 'modified'}
              />
            ))}
          </View>
        )}
      </View>

      {approved && <Text style={rr.check}>✓</Text>}
    </TouchableOpacity>
  );
}

const rr = StyleSheet.create({
  wrap:            { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  wrapSelected:    { backgroundColor: Colors.surface, borderLeftWidth: 3, borderLeftColor: Colors.green },
  wrapApproved:    { opacity: 0.4 },
  thumb:           { width: 48, height: 48, borderRadius: 8, flexShrink: 0 },
  thumbPlaceholder:{ backgroundColor: Colors.surfaceElevated },
  info:            { flex: 1, gap: 3 },
  name:            { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textPrimary, lineHeight: 17 },
  nameSelected:    { color: Colors.green },
  nameApproved:    { color: Colors.textMuted },
  meta:            { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  tags:            { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4 },
  check:           { color: Colors.green, fontSize: 14, alignSelf: 'center' },
});

// ── Diet tag edit card ────────────────────────────────────────────────────────

function DietCard({
  code, tag, onChange, recipeName, reviewFlags, onFlagResolved,
}: {
  code:            string;
  tag?:            DietTagData;
  onChange:        (code: string, updated: DietTagData) => void;
  recipeName?:     string;
  reviewFlags?:    ReviewItem[];
  onFlagResolved?: (ingredient: string, decision: 'compliant' | 'replace' | 'remove' | 'skip', note?: string) => void;
}) {
  const state     = getDietState(tag);
  const notes     = tag?.notes ?? '';
  const color     = (DIET_COLORS as Record<string, string>)[code] ?? Colors.textMuted;
  const showNotes = state === 'mod' || notes.trim().length > 0;

  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  function setDietState(next: DietState) {
    onChange(code, { native: next === 'native', mod: next === 'mod', notes: next === 'none' ? '' : notes });
  }

  async function handleFlag(flag: ReviewItem, decision: 'compliant' | 'replace' | 'remove' | 'skip') {
    if (decision === 'replace') {
      setGeneratingFor(flag.ingredient);
      try {
        const note = await generateSwapNote(recipeName ?? '', code, flag.ingredient, flag.reason, tag?.notes);
        onChange(code, { native: false, mod: true, notes: note });
        onFlagResolved?.(flag.ingredient, 'replace', note);
      } catch (e) {
        console.warn('generateSwapNote failed', e);
        onFlagResolved?.(flag.ingredient, 'replace');
      }
      setGeneratingFor(null);
    } else {
      if (decision === 'compliant') onChange(code, { ...tag, native: true, mod: false, notes: notes });
      if (decision === 'remove')    onChange(code, { native: false, mod: false, notes: '' });
      onFlagResolved?.(flag.ingredient, decision);
    }
  }

  const unresolvedFlags = (reviewFlags ?? []).filter(f => !f.resolved);

  return (
    <View style={dc.wrap}>
      <View style={dc.row}>
        <View style={dc.left}>
          <View style={dc.badgeRow}>
            <View style={[
              dc.circle,
              state === 'native' ? { backgroundColor: color, borderColor: color } :
              state === 'mod'    ? { backgroundColor: 'transparent', borderColor: color, borderStyle: 'dashed' as any } :
                                   { backgroundColor: 'transparent', borderColor: Colors.border },
            ]} />
            <View style={[dc.badge, { backgroundColor: color + '26' }]}>
              <Text style={[dc.code, { color }]}>{code}</Text>
            </View>
            {unresolvedFlags.length > 0 && (
              <View style={dc.flagBadge}>
                <Text style={dc.flagBadgeText}>{unresolvedFlags.length} flag{unresolvedFlags.length !== 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
          <View style={dc.toggleRow}>
            {(['native', 'mod', 'none'] as DietState[]).map(s => (
              <TouchableOpacity
                key={s}
                style={[dc.toggle, state === s && dc[`toggle_${s}` as keyof typeof dc]]}
                onPress={() => setDietState(s)}
              >
                <Text style={[dc.toggleText, state === s && dc[`toggleText_${s}` as keyof typeof dc]]}>
                  {s === 'native' ? 'Native' : s === 'mod' ? 'Mod' : 'None'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={dc.right}>
          {showNotes ? (
            <TextInput
              style={dc.notes}
              value={notes}
              onChangeText={v => onChange(code, { native: tag?.native ?? false, mod: tag?.mod ?? false, notes: v })}
              placeholder="Modification note…"
              placeholderTextColor={Colors.textMuted}
              multiline
            />
          ) : (
            <Text style={dc.noNotes}>—</Text>
          )}
        </View>
      </View>

      {/* Unresolved flags for this protocol */}
      {unresolvedFlags.map((flag, i) => (
        <View key={i} style={dc.flagRow}>
          <View style={dc.flagHeader}>
            <Text style={dc.flagIngredient}>{flag.ingredient}</Text>
            {flag.category ? <Text style={dc.flagCat}>{flag.category.replace(/_/g, ' ')}</Text> : null}
          </View>
          <Text style={dc.flagReason}>{flag.reason}</Text>
          {flag.caution ? <Text style={dc.flagCaution}>FIG: {flag.caution}</Text> : null}
          {generatingFor === flag.ingredient ? (
            <View style={dc.generating}>
              <ActivityIndicator size="small" color={Colors.gold} />
              <Text style={dc.generatingText}>Generating swap note…</Text>
            </View>
          ) : (
            <View style={dc.flagBtns}>
              <TouchableOpacity style={[dc.flagBtn, dc.flagBtnCompliant]} onPress={() => handleFlag(flag, 'compliant')}>
                <Text style={dc.flagBtnText}>Compliant</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[dc.flagBtn, dc.flagBtnReplace]} onPress={() => handleFlag(flag, 'replace')}>
                <Text style={dc.flagBtnText}>Replace ✦</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[dc.flagBtn, dc.flagBtnRemove]} onPress={() => handleFlag(flag, 'remove')}>
                <Text style={dc.flagBtnText}>Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[dc.flagBtn, dc.flagBtnSkip]} onPress={() => handleFlag(flag, 'skip')}>
                <Text style={dc.flagBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const dc = StyleSheet.create({
  wrap:              { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  row:               { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 10 },
  left:              { width: 170, flexShrink: 0 },
  right:             { flex: 1 },
  badgeRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  circle:            { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  badge:             { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  code:              { fontFamily: Fonts.bodyMedium, fontSize: 11, letterSpacing: 0.5 },
  flagBadge:         { backgroundColor: Colors.gold + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  flagBadgeText:     { fontFamily: Fonts.bodyMedium, fontSize: 9, color: Colors.gold },
  toggleRow:         { flexDirection: 'row', gap: 6 },
  toggle:            { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1, borderColor: Colors.border },
  toggleText:        { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  toggle_native:     { backgroundColor: 'rgba(124,184,122,0.15)', borderColor: '#7cb87a' },
  toggleText_native: { color: '#7cb87a' },
  toggle_mod:        { backgroundColor: 'rgba(212,168,67,0.15)', borderColor: '#d4a843' },
  toggleText_mod:    { color: '#d4a843' },
  toggle_none:       { backgroundColor: 'rgba(201,107,107,0.15)', borderColor: '#c96b6b' },
  toggleText_none:   { color: '#c96b6b' },
  notes:             { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, padding: 10, fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 20, minHeight: 44 },
  noNotes:           { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, paddingTop: 4 },

  // Flag rows
  flagRow:           { marginLeft: 8, marginBottom: 12, padding: 12, backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.gold + '44', gap: 6 },
  flagHeader:        { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  flagIngredient:    { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  flagCat:           { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, backgroundColor: Colors.surfaceElevated, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  flagReason:        { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  flagCaution:       { fontFamily: Fonts.body, fontSize: 11, color: Colors.gold },
  generating:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  generatingText:    { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  flagBtns:          { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  flagBtn:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  flagBtnCompliant:  { borderColor: Colors.green,  backgroundColor: Colors.green + '18' },
  flagBtnReplace:    { borderColor: Colors.gold,   backgroundColor: Colors.gold  + '18' },
  flagBtnRemove:     { borderColor: Colors.red,    backgroundColor: Colors.red   + '18' },
  flagBtnSkip:       { borderColor: Colors.border, backgroundColor: Colors.surface },
  flagBtnText:       { fontFamily: Fonts.bodyMedium, fontSize: 11, color: Colors.textPrimary },
});

// ── Diet → category fallback (when notes aren't in "Replace X with Y" format) ──
// When a mod diet is active and no specific swap note matches, we automatically
// flag items in the diet's known problem categories so they show as needing a swap.
const DIET_CATEGORY_FLAGS: Record<string, string[]> = {
  DF:  ['dairy'],                     // Dairy-Free   → cross out all dairy
  V:   ['protein', 'dairy'],          // Vegan        → cross out meat & dairy
  Vg:  ['protein'],                   // Vegetarian   → cross out meat only
  // GF removed — pantry-staples is too broad; GF swaps come from parsed swap notes only
  // AIP / LF / LH / K are too nuanced to map to broad categories
};

// ── Swap parsing (ported from ShopScreen) ─────────────────────────────────────

// Strip leading quantities like "6 Tbsp", "1 1/2 tsp", "2" from ingredient references in swap notes
function stripLeadingQty(s: string): string {
  return s
    .replace(/^[\d\s/½¼¾⅓⅔.]+\s*(tbsp|tsp|tablespoons?|teaspoons?|cups?|oz|lb|g|ml|pounds?|ounces?)\.?\s*/i, '')
    .replace(/\s+entirely\s*$/i, '')
    .trim();
}

// Extract the leading quantity string (e.g. "6 Tbsp") without stripping it
function extractLeadingQty(s: string): string {
  const m = s.match(/^([\d\s/½¼¾⅓⅔.]+\s*(?:tbsp|tsp|tablespoons?|teaspoons?|cups?|oz|lb|g|ml|pounds?|ounces?)\.?)\s*/i);
  return m ? m[1].trim() : '';
}

function parseSwapPairs(notes: string): Array<{ from: string; to: string | null }> {
  const result: Array<{ from: string; to: string | null }> = [];
  const s = notes.toLowerCase();
  let m: RegExpExecArray | null;

  const stopStr = `(?:[,.\\u2013\\u2014]|\\s+[—–]|$)`;

  const insteadRe = new RegExp(`use\\s+(.+?)\\s+instead\\s+of\\s+(.+?)${stopStr}`, 'gi');
  while ((m = insteadRe.exec(s)) !== null) {
    const rawFrom = m[2].trim();
    const rawTo   = m[1].trim();
    const qty     = extractLeadingQty(rawFrom);
    const to      = (qty && !extractLeadingQty(rawTo)) ? `${qty} ${rawTo}` : rawTo;
    result.push({ from: stripLeadingQty(rawFrom), to });
  }

  const replaceRe = new RegExp(`replace\\s+(.+?)\\s+with\\s+(.+?)${stopStr}`, 'gi');
  while ((m = replaceRe.exec(s)) !== null) {
    const rawTo    = m[2].trim().replace(/\s+[—–].*$/, '').trim();
    const toHasQty = extractLeadingQty(rawTo) !== '';
    m[1].split(/\s+and\s+/i).forEach(f => {
      const rawFrom = f.trim();
      const qty     = extractLeadingQty(rawFrom);
      const to      = (qty && !toHasQty) ? `${qty} ${rawTo}` : rawTo;
      result.push({ from: stripLeadingQty(rawFrom), to });
    });
  }

  const removeRe = /remove\s+([^,.\n—–\u2013\u2014]+)/gi;
  while ((m = removeRe.exec(s)) !== null) {
    m[1].split(/\s+and\s+/i).forEach(f => {
      const clean = stripLeadingQty(f.trim());
      if (clean) result.push({ from: clean, to: null });
    });
  }

  const skipRe = /(?:skip|omit)\s+([^,.\n—–\u2013\u2014]+)/gi;
  while ((m = skipRe.exec(s)) !== null) {
    result.push({ from: stripLeadingQty(m[1].split(',')[0].trim()), to: null });
  }

  return result;
}

function fuzzyMatch(term: string, name: string): boolean {
  const clean = (x: string) =>
    x.replace(/\b(cloves?|heads?|tbsp\s+of|tsp\s+of|cups?\s+of|\bof\b)\b/g, '')
     .replace(/\s+/g, ' ').trim();
  const a = clean(term);
  const b = clean(name);
  // Also compare without spaces to handle "cornstarch" vs "corn starch"
  const aFlat = a.replace(/\s+/g, '');
  const bFlat = b.replace(/\s+/g, '');
  return b.includes(a) || a.includes(b) || bFlat.includes(aFlat) || aFlat.includes(bFlat);
}

// ── Shopping list helpers ──────────────────────────────────────────────────────

/**
 * Expands "each:" lines into individual ingredient strings.
 * "¼ tsp each: paprika, onion powder, rosemary" → ["¼ tsp paprika", "¼ tsp onion powder", "¼ tsp rosemary"]
 * If no comma/semicolon delimiters are found, returns the original string unchanged.
 */
function expandEachLine(raw: string): string[] {
  const m = raw.match(/^((?:[\d\s/½¼¾⅓⅔.]+\s*(?:tbsp|tsp|tablespoons?|teaspoons?|cups?|oz|lb|g|ml)\.?\s+)?)each[:\s]+(.+)$/i);
  if (!m) return [raw];
  const qty = m[1].trim();
  const rest = m[2].trim();
  // Only split when explicit delimiters are present; otherwise can't reliably parse multi-word names
  if (!/[,;&]|\band\b/i.test(rest)) return [raw];
  const items = rest.split(/[,;]|\band\b/i).map(s => s.trim()).filter(Boolean);
  if (items.length <= 1) return [raw];
  return items.map(item => qty ? `${qty} ${item}` : item);
}

// ── Shopping list ─────────────────────────────────────────────────────────────

type IngItem = {
  qty: number; unit: string; name: string; category: string;
  _type: 'normal' | 'swap' | 'crossed';
  _qtyOverride?: string;  // display override for qty (e.g. "¼ tsp", "1½ lb")
  _uid?: string;          // unique edit key: `${rawIndex}:${raw}`
  _swapFor?: string;
  _swapTo?:  string;
  _protocol?: string;
  _color?:    string;
  _matched?:  boolean;
  _isCategoryFlag?: boolean;
  _rawIndex?: number;   // index in original ingredients[] array
  _raw?: string;        // original raw string e.g. "½ cup feta cheese crumbled"
};

function ShoppingList({
  ingredients, ingredientNameOverrides, dietTags, activeDietFilter, onSaveNameOverride, onEditSwap, onAddIngredient, onDeleteIngredient, onRevertCategory,
}: {
  ingredients: string[];
  ingredientNameOverrides?: Record<string, { name?: string; qty?: string }>;
  dietTags?: Record<string, DietTagData>;
  activeDietFilter: Set<string>;
  onSaveNameOverride?: (raw: string, overrides: { name?: string; qty?: string }) => void;
  onEditSwap?: (protocol: string, oldSwapText: string, newSwapText: string) => void;
  onAddIngredient?: (raw: string, category?: string) => void;
  onDeleteIngredient?: (rawIndex: number) => void;
  onRevertCategory?: (rawStrings: string[]) => void;
}) {
  const [editingIdx, setEditingIdx]         = useState<string | null>(null); // keyed by _raw string (unique per expanded item)
  const [editingName, setEditingName]       = useState('');
  const [editingQty, setEditingQty]         = useState('');
  const [editingSwapKey, setEditingSwapKey] = useState<string | null>(null); // `${protocol}-${swapFor}`
  const [editingSwapVal, setEditingSwapVal] = useState('');
  const [savedIngredients, setSavedIngredients] = useState<Set<string>>(new Set());
  const [pickerItem, setPickerItem] = useState<{ name: string; category: string } | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  // addingNewCategory: which category section is open for inline add (null = none)
  const [addingNewCategory, setAddingNewCategory] = useState<string | null>(null);
  const [newQty, setNewQty]                 = useState('');
  const [newName, setNewName]               = useState('');
  const [draggingItem, setDraggingItem]     = useState<{ name: string; fromCategory: string } | null>(null);
  const draggingItemRef = useRef<{ name: string; fromCategory: string } | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  // Persists across re-renders so blur/focus on the edit fields can reliably cancel each other
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse all ingredients into base items (keep original index for editing).
  // "each:" lines are expanded first: "¼ tsp each: paprika, thyme" → two rows, both pointing to the same rawIndex.
  const baseItems = useMemo((): { qty: number; unit: string; name: string; category: string; matched: boolean; rawIndex: number; raw: string; uid: string; qtyOverride?: string }[] => {
    const result: { qty: number; unit: string; name: string; category: string; matched: boolean; rawIndex: number; raw: string; uid: string; qtyOverride?: string }[] = [];
    for (let rawIndex = 0; rawIndex < ingredients.length; rawIndex++) {
      const original = ingredients[rawIndex];
      if (!original.trim()) continue;
      const expanded = expandEachLine(original);
      for (const raw of expanded) {
        const p = parseIngredient(raw);
        if (!p.name) continue;
        const { category, matched } = categorizeIngredientWithMatch(p.name);
        const override = ingredientNameOverrides?.[raw];
        const name      = override?.name ?? p.name;
        const qtyOverride = override?.qty;
        const uid = `${rawIndex}:${raw}`;
        result.push({ qty: p.qty ?? 0, unit: p.unit ?? '', name, category, matched, rawIndex, raw, uid, qtyOverride });
      }
    }
    return result;
  }, [ingredients, savedIngredients, ingredientNameOverrides]);

  // Build swap map from active diet modification notes (notes-based swaps only)
  const swapMap = useMemo((): Map<string, { to: string | null; protocol: string; color: string }> => {
    if (activeDietFilter.size === 0 || !dietTags) return new Map();
    const map = new Map<string, { to: string | null; protocol: string; color: string }>();
    for (const code of activeDietFilter) {
      const tagData = dietTags[code];
      if (!tagData?.mod) continue;
      const color = (DIET_COLORS as Record<string, string>)[code] ?? Colors.gold;
      const notes = tagData.notes ?? '';
      if (!notes.trim()) continue;
      const pairs = parseSwapPairs(notes);
      for (const pair of pairs) {
        for (const item of baseItems) {
          if (fuzzyMatch(pair.from, item.name) && !map.has(item.name)) {
            map.set(item.name, { to: pair.to, protocol: code, color });
          }
        }
      }
    }
    return map;
  }, [activeDietFilter, dietTags, baseItems]);

  // Group into categories, injecting swap/crossed rows
  const grouped = useMemo(() => {
    const map: Record<string, IngItem[]> = {};
    SHOPPING_CATEGORIES.forEach(c => { map[c.key] = []; });

    // Track which names have already been placed per category to deduplicate
    // (e.g. "salt" listed 3× in a recipe → one row with summed qty)
    const placed = new Map<string, IngItem>(); // key: `${cat}::${name}`

    for (const item of baseItems) {
      const cat = item.category || 'pantry-staples';
      if (!map[cat]) map[cat] = [];
      const swapInfo = swapMap.get(item.name);

      if (swapInfo) {
        if (swapInfo.to) {
          // Gold swap row: specific replacement from notes — dedupe by swap target name
          const key = `${cat}::swap::${swapInfo.to}`;
          if (!placed.has(key)) {
            const row: IngItem = { qty: 0, unit: '', name: swapInfo.to, category: cat, _type: 'swap', _swapFor: item.name, _protocol: swapInfo.protocol, _color: swapInfo.color };
            map[cat].push(row);
            placed.set(key, row);
          }
        } else {
          const key = `${cat}::${item.name}`;
          if (!placed.has(key)) {
            const row: IngItem = { ...item, _type: 'crossed', _protocol: swapInfo.protocol, _color: swapInfo.color, _isCategoryFlag: false, _rawIndex: item.rawIndex, _raw: item.raw, _uid: item.uid };
            map[cat].push(row);
            placed.set(key, row);
          } else {
            // Sum qty for duplicates
            const existing = placed.get(key)!;
            if (existing.unit === item.unit) existing.qty = (existing.qty || 0) + (item.qty || 0);
          }
        }
      } else {
        // Category-level fallback: when a diet is active, flag ingredients in that
        // diet's known problem categories. No mod check — if DF is native the recipe
        // has no dairy anyway; if it does have dairy, flagging it is correct.
        let catFlag: { protocol: string; color: string } | null = null;
        if (activeDietFilter.size > 0) {
          for (const code of activeDietFilter) {
            const flagCats = DIET_CATEGORY_FLAGS[code] ?? [];
            if (flagCats.includes(cat)) {
              catFlag = { protocol: code, color: (DIET_COLORS as Record<string, string>)[code] ?? Colors.gold };
              break;
            }
          }
        }

        const key = `${cat}::${item.name}`;
        if (placed.has(key)) {
          // Merge duplicate: sum qty if units match
          const existing = placed.get(key)!;
          if (existing.unit === item.unit) existing.qty = (existing.qty || 0) + (item.qty || 0);
        } else if (catFlag) {
          const row: IngItem = { ...item, _type: 'crossed', _protocol: catFlag.protocol, _color: catFlag.color, _isCategoryFlag: true, _rawIndex: item.rawIndex, _raw: item.raw, _uid: item.uid };
          map[cat].push(row);
          placed.set(key, row);
        } else {
          const row: IngItem = { ...item, _type: 'normal', _matched: item.matched, _rawIndex: item.rawIndex, _raw: item.raw, _uid: item.uid, _qtyOverride: item.qtyOverride };
          map[cat].push(row);
          placed.set(key, row);
        }
      }
    }

    // Post-process: remove sub-components already covered by a compound entry.
    // e.g. if "salt and pepper" is in the list, remove standalone "salt" and "pepper".
    for (const cat of Object.keys(map)) {
      const names = map[cat].map(i => i.name);
      map[cat] = map[cat].filter(item => {
        // Keep if no other entry's name contains this name as a whole word/token
        return !names.some(other =>
          other !== item.name &&
          other.length > item.name.length &&
          new RegExp(`(?:^|\\s|and|&)${item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|and|&|$)`, 'i').test(other)
        );
      });
    }

    return SHOPPING_CATEGORIES.map(c => ({ ...c, items: map[c.key] ?? [] })).filter(c => c.items.length > 0);
  }, [baseItems, swapMap, activeDietFilter, dietTags]);

  async function saveCategory(name: string, category: string) {
    // Update UI immediately — don't wait for Firestore
    addIngredientToDb(name, category);
    setSavedIngredients(prev => new Set([...prev, name]));
    setPickerItem(null);

    // Persist to Firestore in the background
    try {
      const { collection: col, doc: docFn, setDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('../../lib/firebase');
      const docId = name.toLowerCase().replace(/\//g, '-').replace(/[^a-z0-9\-_ ']/g, '').trim();
      await setDoc(docFn(col(firestoreDb, 'ingredientCategories'), docId), {
        name,
        category,
        frequency: 1,
        exampleRaw: name,
      });
    } catch (e) {
      console.warn('[saveCategory] Firestore write failed (UI already updated):', e);
    }
  }

  if (!ingredients.length) {
    return <Text style={sl.empty}>No ingredients — add them in the edit section below</Text>;
  }

  return (
    <View>
      {grouped.map(cat => (
        <View
          key={cat.key}
          style={[sl.category, dragOverCategory === cat.key && draggingItem?.fromCategory !== cat.key && sl.categoryDropTarget]}
          {...{
            onDragOver: (e: any) => { e.preventDefault(); const di = draggingItemRef.current; if (di && di.fromCategory !== cat.key) setDragOverCategory(cat.key); },
            onDragLeave: () => setDragOverCategory(null),
            onDrop: (e: any) => {
              e.preventDefault();
              setDragOverCategory(null);
              const di = draggingItemRef.current;
              if (di && di.fromCategory !== cat.key) {
                saveCategory(di.name, cat.key);
              }
              draggingItemRef.current = null;
              setDraggingItem(null);
            },
          }}
        >
          <View style={sl.catHeader}>
            <Text style={sl.catLabel}>{cat.label.toUpperCase()}</Text>
            <View style={sl.catBadge}><Text style={sl.catCount}>{cat.items.length}</Text></View>
            {(() => {
              const overriddenRaws = cat.items
                .filter(it => it._raw !== undefined && ingredientNameOverrides?.[it._raw] !== undefined)
                .map(it => it._raw!);
              return overriddenRaws.length > 0 ? (
                <TouchableOpacity
                  style={sl.revertBtn}
                  onPress={() => onRevertCategory?.(overriddenRaws)}
                  activeOpacity={0.7}
                >
                  <Text style={sl.revertBtnText}>Revert</Text>
                </TouchableOpacity>
              ) : null;
            })()}
            <TouchableOpacity
              style={sl.catAddBtn}
              onPress={() => { setAddingNewCategory(cat.key); setNewQty(''); setNewName(''); }}
              activeOpacity={0.7}
            >
              <Text style={sl.catAddBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          {cat.items.map((item, i) => {
            const key = `${cat.key}-${i}`;

            // Gold swap row — replacement ingredient (tap to edit)
            if (item._type === 'swap') {
              const c = item._color ?? Colors.gold;
              const swapKey = `${item._protocol}-${item._swapFor}`;
              const isEditingSwap = editingSwapKey === swapKey;

              if (isEditingSwap) {
                return (
                  <View key={key} style={[sl.editRow, { borderLeftWidth: 2, borderLeftColor: c }]}>
                    <View style={sl.editFields}>
                      <TextInput
                        style={[sl.editInput, { borderColor: c }]}
                        value={editingSwapVal}
                        onChangeText={setEditingSwapVal}
                        autoFocus
                        selectTextOnFocus
                        placeholderTextColor={Colors.textMuted}
                      />
                      <Text style={[sl.editHint, { color: c + 'aa' }]}>
                        {item._protocol} swap · replaces {item._swapFor}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[sl.editSave, { borderColor: c, backgroundColor: c + '22' }]}
                      onPress={() => {
                        if (editingSwapVal.trim() && item._protocol) {
                          onEditSwap?.(item._protocol, item.name, editingSwapVal.trim());
                        }
                        setEditingSwapKey(null);
                      }}
                    >
                      <Text style={[sl.editSaveText, { color: c }]}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={sl.editCancel} onPress={() => setEditingSwapKey(null)}>
                      <Text style={sl.editCancelText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={key}
                  style={[sl.row, sl.rowSwap, { borderLeftColor: c }]}
                  onPress={() => { setEditingSwapKey(swapKey); setEditingSwapVal(item.name); }}
                  activeOpacity={0.7}
                >
                  <View style={[sl.checkbox, sl.checkboxSwap, { borderColor: c, backgroundColor: c + '22' }]}>
                    <Text style={[sl.swapIcon, { color: c }]}>↑</Text>
                  </View>
                  <View style={sl.rowBody}>
                    <Text style={[sl.swapName, { color: c }]}>{item.name}</Text>
                    <Text style={sl.swapSource}>
                      <Text style={{ color: c }}>{item._protocol} swap</Text>
                      {' · replaces '}{item._swapFor}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }

            // Crossed-out row — ingredient removed or needs swap
            if (item._type === 'crossed') {
              const c = item._color ?? Colors.red;
              const label = item._isCategoryFlag ? 'needs swap — update note above' : 'removed';
              return (
                <View key={key} style={[sl.row, sl.rowCrossed, { borderLeftColor: c }]}>
                  <View style={[sl.checkbox, sl.checkboxCrossed, { borderColor: c, backgroundColor: c + '22' }]} />
                  <View style={sl.rowBody}>
                    <Text style={sl.crossedName}>{item.name}</Text>
                    <Text style={sl.swapSource}>
                      <Text style={{ color: c }}>{item._protocol} swap</Text>
                      {' · '}{label}
                    </Text>
                  </View>
                </View>
              );
            }

            // Normal row — tap to edit inline
            const isUnmatched = item._matched === false && !savedIngredients.has(item.name);
            const isEditing = item._uid !== undefined && editingIdx === item._uid;

            if (isEditing) {
              const onFieldBlur = () => {
                blurTimerRef.current = setTimeout(() => {
                  if (item._raw !== undefined) {
                    const overrides: { name?: string; qty?: string } = {};
                    if (editingName.trim()) overrides.name = editingName.trim();
                    overrides.qty = editingQty.trim();
                    onSaveNameOverride?.(item._raw, overrides);
                  }
                  setEditingIdx(null);
                }, 150);
              };
              const onFieldFocus = () => {
                if (blurTimerRef.current) { clearTimeout(blurTimerRef.current); blurTimerRef.current = null; }
              };
              const commitEdit = () => {
                if (blurTimerRef.current) { clearTimeout(blurTimerRef.current); blurTimerRef.current = null; }
                if (item._raw !== undefined) {
                  const overrides: { name?: string; qty?: string } = {};
                  if (editingName.trim()) overrides.name = editingName.trim();
                  overrides.qty = editingQty.trim();
                  onSaveNameOverride?.(item._raw, overrides);
                }
                setEditingIdx(null);
              };
              return (
                <View key={key} style={sl.editRow}>
                  <TextInput
                    style={[sl.editInput, sl.editQtyInput, editingQty.trim() === '' && sl.editInputWarning]}
                    value={editingQty}
                    onChangeText={setEditingQty}
                    autoFocus
                    selectTextOnFocus
                    placeholder="Qty"
                    placeholderTextColor={Colors.textMuted}
                    returnKeyType="next"
                    onSubmitEditing={commitEdit}
                    onFocus={onFieldFocus}
                    onBlur={onFieldBlur}
                  />
                  <TextInput
                    style={[sl.editInput, sl.editNameInput]}
                    value={editingName}
                    onChangeText={setEditingName}
                    selectTextOnFocus
                    placeholder="Ingredient name"
                    placeholderTextColor={Colors.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={commitEdit}
                    onFocus={onFieldFocus}
                    onBlur={onFieldBlur}
                  />
                  <TouchableOpacity
                    style={sl.editSave}
                    onPress={commitEdit}
                  >
                    <Text style={sl.editSaveText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={sl.editCancel}
                    onPress={() => setEditingIdx(null)}
                  >
                    <Text style={sl.editCancelText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            const isDraggable = item._type === 'normal' && !isUnmatched;
            const isBeingDragged = draggingItem?.name === item.name && draggingItem?.fromCategory === cat.key;
            return (
              // Wrap in a plain View so the drag handle sits outside TouchableOpacity
              // (TouchableOpacity intercepts mousedown and blocks browser drag)
              <View key={key} style={[sl.rowWrap, isBeingDragged && sl.rowDragging]}>
                {isDraggable && (
                  <View
                    style={sl.dragHandle}
                    {...{
                      draggable: true,
                      onDragStart: (e: any) => { e.dataTransfer?.setData('text/plain', item.name); const val = { name: item.name, fromCategory: cat.key }; draggingItemRef.current = val; setDraggingItem(val); },
                      onDragEnd:   () => { draggingItemRef.current = null; setDraggingItem(null); setDragOverCategory(null); },
                    }}
                  >
                    <Text style={sl.dragHandleText}>⠿</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[sl.row, isUnmatched && sl.rowUnmatched]}
                  onPress={() => {
                    if (isUnmatched) {
                      setPickerItem({ name: item.name, category: item.category ?? 'pantry-staples' });
                    } else if (item._uid !== undefined) {
                      setEditingIdx(item._uid);
                      setEditingQty(item._qtyOverride !== undefined ? item._qtyOverride : (item.qty ? fmtQty(item.qty, item.unit, item.category) : item.unit || ''));
                      setEditingName(item.name);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[sl.checkbox, isUnmatched && sl.checkboxUnmatched]}>
                    {isUnmatched && <Text style={sl.unmatchedIcon}>?</Text>}
                  </View>
                  <Text style={[sl.qty, item._qtyOverride === '' && sl.qtyWarning]}>
                    {item._qtyOverride !== undefined ? item._qtyOverride : (item.qty ? fmtQty(item.qty, item.unit, item.category) : item.unit || '')}
                  </Text>
                  <Text style={[sl.name, isUnmatched && sl.nameUnmatched]}>{item.name}</Text>
                  {item._rawIndex !== undefined && (
                    <TouchableOpacity
                      style={sl.deleteBtn}
                      onPress={e => { e.stopPropagation?.(); onDeleteIngredient?.(item._rawIndex!); }}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={sl.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}

          {/* ── Per-category inline add ── */}
          {addingNewCategory === cat.key ? (
            <View style={sl.editRow}>
              <TextInput
                style={[sl.editInput, sl.editQtyInput, newQty.trim() === '' && sl.editInputWarning]}
                value={newQty}
                onChangeText={setNewQty}
                autoFocus
                placeholder="Qty"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="next"
              />
              <TextInput
                style={[sl.editInput, sl.editNameInput]}
                value={newName}
                onChangeText={setNewName}
                placeholder="Ingredient name"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={() => {
                  const raw = [newQty.trim(), newName.trim()].filter(Boolean).join(' ');
                  if (raw) {
                    onAddIngredient?.(raw, cat.key);
                    const n = parseIngredient(raw).name;
                    if (n) saveCategory(n, cat.key);
                  }
                  setAddingNewCategory(null); setNewQty(''); setNewName('');
                }}
              />
              <TouchableOpacity
                style={sl.editSave}
                onPress={() => {
                  const raw = [newQty.trim(), newName.trim()].filter(Boolean).join(' ');
                  if (raw) {
                    onAddIngredient?.(raw, cat.key);
                    const n = parseIngredient(raw).name;
                    if (n) saveCategory(n, cat.key);
                  }
                  setAddingNewCategory(null); setNewQty(''); setNewName('');
                }}
              >
                <Text style={sl.editSaveText}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sl.editCancel} onPress={() => { setAddingNewCategory(null); setNewQty(''); setNewName(''); }}>
                <Text style={sl.editCancelText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ))}

      {/* ── Unmatched ingredient category picker ── */}
      {pickerItem && (
        <Modal transparent animationType="slide" onRequestClose={() => setPickerItem(null)}>
          <View style={sl.modalOverlay}>
            {/* Backdrop tap-to-close sits behind the sheet */}
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              onPress={() => setPickerItem(null)}
              activeOpacity={1}
            />
            <View style={sl.modalSheet}>
              <View style={sl.modalHeader}>
                <Text style={sl.modalTitle}>Assign category</Text>
                <TouchableOpacity onPress={() => setPickerItem(null)}>
                  <Text style={sl.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={sl.modalIngName}>"{pickerItem.name}"</Text>
              <Text style={sl.modalSub}>Not in ingredient database — pick a category to save it</Text>
              {SHOPPING_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  style={sl.modalOption}
                  onPress={() => {
                    if (!savingCategory) saveCategory(pickerItem.name, cat.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={sl.modalOptionText}>{cat.label}</Text>
                  {savingCategory && <ActivityIndicator size="small" color={Colors.green} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const sl = StyleSheet.create({
  empty:          { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, fontStyle: 'italic', paddingVertical: 8 },
  category:       { marginBottom: 20 },
  catHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  catLabel:       { fontFamily: Fonts.bodyMedium, fontSize: 10, color: Colors.textMuted, letterSpacing: 1 },
  catBadge:       { backgroundColor: Colors.surfaceElevated, borderRadius: 100, paddingHorizontal: 7, paddingVertical: 1 },
  catCount:       { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  revertBtn:      { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: Colors.border },
  revertBtnText:  { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  row:            { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowSwap:        { backgroundColor: 'rgba(212,168,67,0.07)', borderRadius: 6, paddingHorizontal: 6, borderLeftWidth: 2, borderLeftColor: Colors.gold },
  rowCrossed:     { backgroundColor: 'rgba(201,107,107,0.07)', borderRadius: 6, paddingHorizontal: 6, borderLeftWidth: 2, borderLeftColor: Colors.red },
  checkbox:       { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxDone:   { backgroundColor: Colors.green, borderColor: Colors.green },
  checkboxSwap:   { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  checkboxCrossed:{ borderColor: Colors.red, backgroundColor: Colors.red + '22' },
  checkmark:      { fontSize: 12, color: Colors.bg, fontFamily: Fonts.bodyMedium },
  swapIcon:       { fontSize: 12, color: Colors.gold, fontFamily: Fonts.bodyMedium },
  rowBody:        { flex: 1, gap: 3 },
  qty:            { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.gold, minWidth: 60 },
  name:           { fontFamily: Fonts.body, fontSize: 16, color: Colors.textPrimary, flex: 1 },
  swapName:       { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.gold },
  crossedName:    { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, textDecorationLine: 'line-through' },
  swapSource:     { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  done:           { opacity: 0.35, textDecorationLine: 'line-through' },
  // Unmatched ingredient styles
  rowUnmatched:     { backgroundColor: 'rgba(201,107,107,0.07)', borderRadius: 6, paddingHorizontal: 6, borderLeftWidth: 2, borderLeftColor: Colors.red },
  rowIngSaved:      { backgroundColor: 'rgba(124,184,122,0.07)', borderRadius: 6, paddingHorizontal: 6, borderLeftWidth: 2, borderLeftColor: Colors.green },
  checkboxUnmatched:{ borderColor: Colors.red, backgroundColor: Colors.red + '22' },
  checkboxIngSaved: { borderColor: Colors.green, backgroundColor: Colors.green + '22' },
  unmatchedIcon:    { fontSize: 11, color: Colors.red, fontFamily: Fonts.bodyMedium },
  nameUnmatched:    { color: Colors.red },
  unmatchedHint:    { fontFamily: Fonts.body, fontSize: 10, color: Colors.red, opacity: 0.7 },
  deleteBtn:        { marginLeft: 'auto', paddingLeft: 8, paddingVertical: 4 },
  deleteBtnText:    { fontSize: 13, color: Colors.textMuted },
  rowWrap:          { flexDirection: 'row', alignItems: 'center' },
  dragHandle:       { paddingHorizontal: 6, paddingVertical: 10, justifyContent: 'center', cursor: 'grab', userSelect: 'none' } as any,
  dragHandleText:   { fontSize: 14, color: Colors.textMuted },
  rowDragging:      { opacity: 0.4 },
  categoryDropTarget: { borderWidth: 1.5, borderColor: Colors.gold, borderRadius: 8, paddingHorizontal: 8, backgroundColor: Colors.gold + '0a' },
  catAddBtn:        { marginLeft: 6, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: Colors.border },
  catAddBtnText:    { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted, lineHeight: 18 },
  editPencil:       { fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.body },
  editRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  editFields:       { flex: 1, gap: 4 },
  editInput:        { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.borderActive, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary },
  editQtyInput:     { width: 80, flexShrink: 0 },
  editNameInput:    { flex: 1 },
  editInputWarning: { borderColor: Colors.red },
  qtyWarning:       { color: Colors.red },
  editHint:         { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, paddingHorizontal: 2 },
  editSave:         { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.green + '22', borderRadius: 6, borderWidth: 1, borderColor: Colors.green },
  editSaveText:     { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.green },
  editCancel:       { paddingHorizontal: 8, paddingVertical: 6 },
  editCancelText:   { fontFamily: Fonts.body, fontSize: 16, color: Colors.textMuted },
  // Category picker modal
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: Colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 40 },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle:       { fontFamily: Fonts.bodyMedium, fontSize: 15, color: Colors.textPrimary },
  modalClose:       { fontFamily: Fonts.body, fontSize: 16, color: Colors.textMuted, padding: 4 },
  modalIngName:     { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.textPrimary, paddingHorizontal: 20, paddingTop: 14 },
  modalSub:         { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, paddingHorizontal: 20, paddingBottom: 12 },
  modalOption:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalOptionText:  { fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary },
});

// ── Right panel ───────────────────────────────────────────────────────────────

function RecipePanel({
  recipe, saving, savedFields, onChange, onApprove, onReject, onSkip,
}: {
  recipe:      RecipeDoc;
  saving:      boolean;
  savedFields: Set<string>;
  onChange:    (fields: Partial<RecipeDoc>) => void;
  onApprove:   () => void;
  onReject:    () => void;
  onSkip:      () => void;
}) {
  const [local, setLocal]           = useState<RecipeDoc>(recipe);
  const [activeDiet, setActiveDiet] = useState<Set<string>>(new Set());

  useEffect(() => { setLocal(recipe); setActiveDiet(new Set()); }, [recipe._id]);

  function update(fields: Partial<RecipeDoc>) {
    const updated = { ...local, ...fields };
    setLocal(updated);
    onChange(fields);
  }

  function updateDietTag(code: string, tag: DietTagData) {
    update({ dietTags: { ...(local.dietTags ?? {}), [code]: tag } });
  }

  function updateIngredient(i: number, val: string) {
    const ings = [...(local.ingredients ?? [])];
    ings[i] = val;
    update({ ingredients: ings });
  }

  async function handleFlagResolved(code: string, ingredient: string, decision: 'compliant' | 'replace' | 'remove' | 'skip', note?: string) {
    const updatedItems = (local.reviewItems ?? []).map(i =>
      i.protocol === code && i.ingredient === ingredient && !i.resolved
        ? { ...i, resolved: true, finalDecision: decision, swapNote: note || '' }
        : i
    );
    // Update local state (dietTag already updated via onChange inside DietCard)
    setLocal(prev => ({ ...prev, reviewItems: updatedItems }));
    // Write flag resolution to Firestore (handles its own dietTag update)
    try {
      await resolveReviewItem(
        local._id,
        code,
        ingredient,
        decision,
        (local.dietTags ?? {}) as Record<string, Record<string, unknown>>,
        local.reviewItems ?? [],
        note,
      );
    } catch (e) { console.warn('resolveReviewItem failed', e); }
  }

  function toggleDietFilter(code: string) {
    setActiveDiet(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  // Field border highlight
  function fieldBorder(key: keyof RecipeDoc) {
    if (savedFields.has(key)) return pp.inputSaved;
    const val = local[key];
    if (!val || (typeof val === 'string' && !val.trim())) return pp.inputMissing;
    return null;
  }

  function sectionStyle(keys: (keyof RecipeDoc)[]) {
    if (keys.some(k => savedFields.has(k))) return pp.sectionSaved;
    if (keys.some(k => { const v = local[k]; return !v || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length); })) return pp.sectionMissing;
    return null;
  }

  // Diet states for the filter row (only show diets that have native or mod)
  const activeDietTags = DIETS.filter(code =>
    local.dietTags?.[code]?.native || local.dietTags?.[code]?.mod
  );

  return (
    <View style={pp.wrap}>
      <ScrollView style={pp.scroll} contentContainerStyle={pp.content} keyboardShouldPersistTaps="handled">

        {/* ── Recipe card ── */}
        <View style={pp.card}>
          {local.image
            ? <Image source={{ uri: local.image }} style={pp.photo} />
            : <View style={[pp.photo, pp.photoPlaceholder]} />}
          <View style={pp.cardBody}>
            <TextInput
              style={[pp.nameInput, fieldBorder('name')]}
              value={local.name ?? ''}
              onChangeText={v => update({ name: v })}
              placeholder="Recipe name"
              placeholderTextColor={Colors.textMuted}
            />
            {local.url ? (
              <TouchableOpacity onPress={() => Linking.openURL(local.url!)} activeOpacity={0.7}>
                <Text style={[pp.url, pp.urlLink]} numberOfLines={1}>{local.url}</Text>
              </TouchableOpacity>
            ) : null}
            <View style={pp.metaRow}>
              {([
                { label: 'BLOGGER',  key: 'blogger'  as const },
                { label: 'CUISINE',  key: 'cuisine'  as const },
                { label: 'COURSE',   key: 'course'   as const },
                { label: 'PROTEIN',  key: 'protein'  as const },
                { label: 'RATING',   key: 'rating'   as const },
                { label: 'SERVINGS', key: 'servings' as const },
              ] as { label: string; key: keyof RecipeDoc }[]).map(({ label, key }) => (
                <View key={key as string} style={pp.metaItem}>
                  <Text style={pp.metaLabel}>{label}</Text>
                  <TextInput
                    style={[pp.metaInput, fieldBorder(key)]}
                    value={String(local[key] ?? '')}
                    onChangeText={v => update({ [key]: v })}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Diet Protocols — full edit cards with modification notes ── */}
        <View style={[pp.editSection, savedFields.has('dietTags') ? pp.sectionSaved : null]}>
          <Text style={pp.sectionLabel}>DIET PROTOCOLS</Text>
          {DIETS.map(code => (
            <DietCard
              key={code}
              code={code}
              tag={local.dietTags?.[code]}
              onChange={updateDietTag}
              recipeName={local.name}
              reviewFlags={(local.reviewItems ?? []).filter(f => f.protocol === code)}
              onFlagResolved={(ingredient, decision, note) => handleFlagResolved(code, ingredient, decision, note)}
            />
          ))}
        </View>

        {/* ── Chef's Notes ── */}
        <View style={[pp.editSection, sectionStyle(['chefNotes'])]}>
          <Text style={pp.sectionLabel}>CHEF'S NOTES</Text>
          <TextInput
            style={pp.notesInput}
            value={local.chefNotes ?? ''}
            onChangeText={v => update({ chefNotes: v })}
            multiline
            placeholder="Auto-generated from ingredients — edit if needed…"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* ── Ingredients ── */}
        <View style={[pp.editSection, sectionStyle(['ingredients'])]}>
          <Text style={pp.sectionLabel}>
            INGREDIENTS ({local.ingredients?.length ?? 0}) — tap any line to edit
          </Text>
          <View style={pp.ingGrid}>
            {(local.ingredients ?? []).map((ing, i) => (
              <TextInput
                key={i}
                style={pp.ingLine}
                value={ing}
                onChangeText={v => updateIngredient(i, v)}
                placeholderTextColor={Colors.textMuted}
              />
            ))}
          </View>
          <TouchableOpacity
            style={pp.addIngBtn}
            onPress={() => update({ ingredients: [...(local.ingredients ?? []), ''] })}
          >
            <Text style={pp.addIngText}>+ Add ingredient</Text>
          </TouchableOpacity>
        </View>

        {/* ── Shopping List — diet filter circles + parsed ingredients ── */}
        <View style={pp.shopSection}>
          <View style={pp.dietHeader}>
            <Text style={pp.sectionLabel}>SHOPPING LIST</Text>
            {activeDiet.size > 0 && (
              <TouchableOpacity onPress={() => setActiveDiet(new Set())}>
                <Text style={pp.clearDiet}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pp.dietRow}>
            {activeDietTags.length > 0
              ? activeDietTags.map(code => (
                  <DietChip
                    key={code}
                    code={code}
                    active={activeDiet.has(code)}
                    tagState={getDietState(local.dietTags?.[code])}
                    onPress={() => toggleDietFilter(code)}
                  />
                ))
              : <Text style={pp.noDiets}>Set diet protocols above to filter the shopping list</Text>
            }
          </ScrollView>
          <ShoppingList
            ingredients={local.ingredients ?? []}
            ingredientNameOverrides={local.ingredientNameOverrides}
            dietTags={local.dietTags}
            activeDietFilter={activeDiet}
            onEditSwap={async (protocol, oldSwapText, newSwapText) => {
              const tag = local.dietTags?.[protocol];
              if (!tag) return;
              const updatedNote = (tag.notes ?? '').split(oldSwapText).join(newSwapText);
              const updatedTags = {
                ...(local.dietTags ?? {}),
                [protocol]: { ...tag, notes: updatedNote },
              };
              update({ dietTags: updatedTags });
              if (local._id) {
                try {
                  await updateDoc(doc(db, 'recipes', local._id), { dietTags: updatedTags });
                } catch (e) { console.warn('Swap note save failed:', e); }
              }
            }}
            onSaveNameOverride={async (raw, override) => {
              const overrides = { ...(local.ingredientNameOverrides ?? {}), [raw]: override };
              update({ ingredientNameOverrides: overrides });
              if (local._id) {
                try {
                  await updateDoc(doc(db, 'recipes', local._id), { ingredientNameOverrides: overrides });
                } catch (e) { console.warn('Name override save failed:', e); }
              }
            }}
            onAddIngredient={async (raw, _category) => {
              const ings = [...(local.ingredients ?? []), raw];
              update({ ingredients: ings });
              if (local._id) {
                try {
                  await updateDoc(doc(db, 'recipes', local._id), { ingredients: ings });
                } catch (e) { console.warn('Add ingredient failed:', e); }
              }
            }}
            onDeleteIngredient={async (rawIndex) => {
              const ings = (local.ingredients ?? []).filter((_, i) => i !== rawIndex);
              update({ ingredients: ings });
              if (local._id) {
                try {
                  await updateDoc(doc(db, 'recipes', local._id), { ingredients: ings });
                } catch (e) { console.warn('Delete ingredient failed:', e); }
              }
            }}
            onRevertCategory={async (rawStrings) => {
              const overrides = { ...(local.ingredientNameOverrides ?? {}) };
              for (const raw of rawStrings) delete overrides[raw];
              update({ ingredientNameOverrides: overrides });
              if (local._id) {
                try {
                  await updateDoc(doc(db, 'recipes', local._id), { ingredientNameOverrides: overrides });
                } catch (e) { console.warn('Revert category failed:', e); }
              }
            }}
          />
        </View>

      </ScrollView>

      {/* ── Action bar ── */}
      <View style={pp.actionBar}>
        <Text style={pp.savingText}>{saving ? 'Saving…' : 'All changes auto-save'}</Text>
        <View style={pp.btns}>
          <TouchableOpacity style={pp.btnSkip} onPress={onSkip}>
            <Text style={pp.btnSkipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={pp.btnReject} onPress={onReject}>
            <Text style={pp.btnRejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={pp.btnApprove} onPress={onApprove}>
            <Text style={pp.btnApproveText}>✓ Approve → Consumer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const pp = StyleSheet.create({
  wrap:             { flex: 1 },
  scroll:           { flex: 1 },
  content:          { padding: 24, paddingBottom: 24, gap: 24 },

  // Recipe card
  card:             { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  photo:            { width: 130, height: 130, borderRadius: 12, flexShrink: 0 },
  photoPlaceholder: { backgroundColor: Colors.surfaceElevated },
  cardBody:         { flex: 1 },
  nameInput:        { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 4, marginBottom: 8 },
  url:              { fontFamily: Fonts.body, fontSize: 11, color: '#6aabda', marginBottom: 10 },
  urlLink:          { textDecorationLine: 'underline' },
  metaRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem:         { minWidth: 88 },
  metaLabel:        { fontFamily: Fonts.body, fontSize: 9, color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  metaInput:        { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontFamily: Fonts.body, fontSize: 13, color: Colors.textPrimary },

  // Diet filter row
  dietSection:      { gap: 10 },
  dietHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel:     { fontFamily: Fonts.bodyMedium, fontSize: 10, color: Colors.textMuted, letterSpacing: 1 },
  clearDiet:        { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  dietRow:          { gap: 8, paddingVertical: 6 },
  noDiets:          { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', paddingTop: 6 },

  // Shopping list
  shopSection:      { gap: 10 },

  // Edit sections
  editSection:      { gap: 10 },
  sectionMissing:   { borderWidth: 1.5, borderColor: Colors.red, borderRadius: 10, padding: 14, backgroundColor: 'rgba(201,107,107,0.04)' },
  sectionSaved:     { borderWidth: 1.5, borderColor: Colors.green, borderRadius: 10, padding: 14, backgroundColor: 'rgba(124,184,122,0.04)' },

  // Field highlights
  inputMissing:     { borderColor: Colors.red },
  inputSaved:       { borderColor: Colors.green },

  // Chef's notes
  notesInput:       { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, fontFamily: Fonts.body, fontSize: 13, color: Colors.textPrimary, minHeight: 80, textAlignVertical: 'top' },

  // Ingredients
  ingGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  ingLine:          { width: '48%', fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  addIngBtn:        { marginTop: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
  addIngText:       { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },

  // Action bar
  actionBar:        { padding: 14, paddingHorizontal: 24, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  savingText:       { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  btns:             { flexDirection: 'row', gap: 10 },
  btnSkip:          { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 100, borderWidth: 1, borderColor: Colors.border },
  btnSkipText:      { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textMuted },
  btnReject:        { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 100, borderWidth: 1.5, borderColor: Colors.red, backgroundColor: Colors.red + '18' },
  btnRejectText:    { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.red },
  btnApprove:       { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 100, borderWidth: 1.5, borderColor: Colors.green, backgroundColor: Colors.green + '18' },
  btnApproveText:   { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.green },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ReviewQueueScreen() {
  const [recipes, setRecipes]             = useState<RecipeDoc[]>([]);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [search, setSearch]               = useState('');
  const [filterDiets, setFilterDiets]     = useState<Set<string>>(new Set());
  const [filterProtein, setFilterProtein] = useState('');
  const [filterCuisine, setFilterCuisine] = useState('');
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [savedFields, setSavedFields]     = useState<Set<string>>(new Set());

  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFields = useRef<Partial<RecipeDoc>>({});

  useEffect(() => { loadQueue(); }, []);

  async function loadQueue() {
    setLoading(true);
    try {
      // Fetch both pending-review AND already-approved so approved recipes
      // stay in the sidebar permanently (shadowed) even after refresh.
      const [pendingSnap, approvedSnap] = await Promise.all([
        // 'needs_review' = old format (Cloud Function used to overwrite status)
        // 'yes' = new format (swipe decision preserved, processingStatus tracks pipeline stage)
        getDocs(query(collection(db, 'recipes'), where('status', 'in', ['yes', 'needs_review']))),
        getDocs(query(collection(db, 'recipes'), where('status', '==', 'approved'))),
      ]);
      const pending  = pendingSnap.docs.map(d => ({ _id: d.id, ...d.data() } as RecipeDoc));
      const approved = approvedSnap.docs.map(d => ({ _id: d.id, ...d.data(), _approved: true } as RecipeDoc));
      // Pending first, approved after (so unreviewed recipes are at the top)
      setRecipes([...pending, ...approved]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const cuisines = useMemo(() =>
    Array.from(new Set(recipes.map(r => r.cuisine).filter(Boolean) as string[])).sort(),
  [recipes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return recipes.filter(r => {
      if (q && ![(r.name || ''), (r.blogger || ''), (r.cuisine || '')].some(s => s.toLowerCase().includes(q))) return false;
      if (filterProtein && r.protein !== filterProtein) return false;
      if (filterCuisine && r.cuisine !== filterCuisine) return false;
      if (filterDiets.size > 0 && ![...filterDiets].every(d =>
        r.dietTags?.[d]?.native || r.dietTags?.[d]?.mod
      )) return false;
      return true;
    });
  }, [recipes, search, filterProtein, filterCuisine, filterDiets]);

  // ── Select ────────────────────────────────────────────────────────────────
  function selectRecipe(id: string) {
    flushSave();
    setSelectedId(id);
    setSavedFields(new Set());
  }

  // ── Auto-save ─────────────────────────────────────────────────────────────
  function scheduleSave(id: string, fields: Partial<RecipeDoc>) {
    pendingFields.current = { ...pendingFields.current, ...fields };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushSave(id), 800);
  }

  function flushSave(id?: string) {
    const targetId = id ?? selectedId;
    if (!targetId || Object.keys(pendingFields.current).length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const fields = { ...pendingFields.current };
    pendingFields.current = {};
    setSaving(true);
    const savedKeys = Object.keys(fields);
    updateDoc(doc(db, 'recipes', targetId), fields as Record<string, unknown>)
      .then(() => { setSaving(false); setSavedFields(prev => new Set([...prev, ...savedKeys])); })
      .catch(() => setSaving(false));
  }

  function handleChange(fields: Partial<RecipeDoc>) {
    if (!selectedId) return;
    setRecipes(prev => prev.map(r => r._id === selectedId ? { ...r, ...fields } : r));
    scheduleSave(selectedId, fields);
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  async function handleApprove() {
    if (!selectedId) return;
    flushSave();
    try {
      await updateDoc(doc(db, 'recipes', selectedId), { status: 'approved' });
      setRecipes(prev => prev.map(r => r._id === selectedId ? { ...r, _approved: true } : r));
      advanceToNext();
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  // ── Reject ────────────────────────────────────────────────────────────────
  async function handleReject() {
    if (!selectedId) return;
    Alert.alert('Reject Recipe', 'Set back to "no"? This removes it from the queue.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        flushSave();
        try {
          await updateDoc(doc(db, 'recipes', selectedId), { status: 'no' });
          setRecipes(prev => prev.filter(r => r._id !== selectedId));
          advanceToNext();
        } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  }

  function handleSkip() { advanceToNext(); }

  function advanceToNext() {
    const idx  = recipes.findIndex(r => r._id === selectedId);
    const next = recipes.find((r, i) => i > idx && !r._approved);
    setSelectedId(next?._id ?? null);
  }

  // ── Push all ──────────────────────────────────────────────────────────────
  async function handlePushAll() {
    const pending = recipes.filter(r => !r._approved);
    if (!pending.length) return;
    Alert.alert(
      'Push All to Consumer',
      `Approve all ${pending.length} recipes? They go live immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Push ${pending.length}`, onPress: async () => {
          try {
            const batch = writeBatch(db);
            pending.forEach(r => batch.update(doc(db, 'recipes', r._id), { status: 'approved' }));
            await batch.commit();
            setRecipes(prev => prev.map(r => ({ ...r, _approved: true })));
            setSelectedId(null);
          } catch (e: any) { Alert.alert('Error', e.message); }
        }},
      ]
    );
  }

  // ── Counts ────────────────────────────────────────────────────────────────
  const pendingCount   = recipes.filter(r => !r._approved).length;
  const selectedRecipe = recipes.find(r => r._id === selectedId) ?? null;
  const hasFilters     = filterDiets.size > 0 || filterProtein || filterCuisine || search;

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={Colors.textMuted} /></View>;
  }

  return (
    <View style={s.wrap}>

      {/* Top bar */}
      <View style={s.topbar}>
        <Text style={s.topTitle}>Review Queue</Text>
        <View style={s.topRight}>
          <Text style={s.countText}>
            <Text style={{ color: Colors.gold, fontFamily: Fonts.bodyMedium }}>{pendingCount}</Text>
            {' awaiting review'}
          </Text>
          <TouchableOpacity
            style={[s.pushBtn, pendingCount === 0 && s.pushBtnDisabled]}
            onPress={handlePushAll}
            disabled={pendingCount === 0}
          >
            <Text style={s.pushBtnText}>
              {pendingCount > 0 ? `Push ${pendingCount} to Consumer` : 'All Approved'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body */}
      <View style={s.body}>

        {/* ── Left sidebar ── */}
        <View style={s.sidebar}>

          {/* Search */}
          <View style={s.searchWrap}>
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search recipes…"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Diet chip filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipRow}
          >
            {DIETS.map(code => (
              <DietChip
                key={code}
                code={code}
                active={filterDiets.has(code)}
                onPress={() => setFilterDiets(prev => {
                  const next = new Set(prev);
                  next.has(code) ? next.delete(code) : next.add(code);
                  return next;
                })}
              />
            ))}
          </ScrollView>

          {/* Dropdown row */}
          <View style={s.dropRow}>
            <Dropdown label="All proteins" value={filterProtein} options={PROTEINS} onSelect={setFilterProtein} />
            <Dropdown label="All cuisines" value={filterCuisine} options={cuisines}  onSelect={setFilterCuisine} />
            {hasFilters && (
              <TouchableOpacity onPress={() => {
                setFilterDiets(new Set()); setFilterProtein(''); setFilterCuisine(''); setSearch('');
              }}>
                <Text style={s.clearBtn}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Count */}
          <Text style={s.listCount}>
            {filtered.filter(r => !r._approved).length} pending · {filtered.filter(r => r._approved).length} approved
          </Text>

          {/* Recipe list */}
          <FlatList
            data={filtered}
            keyExtractor={r => r._id}
            renderItem={({ item }) => (
              <RecipeRow
                recipe={item}
                selected={item._id === selectedId}
                approved={!!item._approved}
                onSelect={() => selectRecipe(item._id)}
              />
            )}
            ListEmptyComponent={
              <Text style={s.emptyList}>No recipes match filters</Text>
            }
          />
        </View>

        {/* ── Right panel ── */}
        {selectedRecipe ? (
          <RecipePanel
            key={selectedRecipe._id}
            recipe={selectedRecipe}
            saving={saving}
            savedFields={savedFields}
            onChange={handleChange}
            onApprove={handleApprove}
            onReject={handleReject}
            onSkip={handleSkip}
          />
        ) : (
          <View style={s.emptyPanel}>
            <Text style={s.emptyPanelIcon}>👈</Text>
            <Text style={s.emptyPanelText}>
              {recipes.length === 0 ? 'Queue is empty' : 'Select a recipe to review'}
            </Text>
          </View>
        )}

      </View>
    </View>
  );
}

// ── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrap:           { flex: 1, backgroundColor: Colors.bg },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },

  topbar:         { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topTitle:       { fontFamily: Fonts.display, fontSize: 18, color: Colors.textPrimary, letterSpacing: 0.5 },
  topRight:       { flexDirection: 'row', alignItems: 'center', gap: 14 },
  countText:      { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  pushBtn:        { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, borderWidth: 1.5, borderColor: Colors.green, backgroundColor: Colors.green + '18' },
  pushBtnDisabled:{ opacity: 0.35 },
  pushBtnText:    { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.green },

  body:           { flex: 1, flexDirection: 'row' },

  sidebar:        { width: 310, borderRightWidth: 1, borderRightColor: Colors.border },
  searchWrap:     { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput:    { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontFamily: Fonts.body, fontSize: 13, color: Colors.textPrimary },
  chipRow:        { paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center' },
  clearBtn:       { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  listCount:      { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, letterSpacing: 0.8, paddingHorizontal: 14, paddingVertical: 7 },
  emptyList:      { padding: 32, textAlign: 'center', fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },

  emptyPanel:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyPanelIcon: { fontSize: 40 },
  emptyPanelText: { fontFamily: Fonts.display, fontSize: 22, color: Colors.textSecondary },
});
