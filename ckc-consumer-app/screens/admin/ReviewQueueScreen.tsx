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
  Image, ActivityIndicator, Alert, StyleSheet, Modal, Pressable,
} from 'react-native';
import { parseIngredient, fmtQty, SHOPPING_CATEGORIES } from '../../lib/ingredientParser';
import {
  collection, query, where, getDocs, doc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Colors, Fonts } from '../../constants/theme';
import DietTag, { DIET_COLORS } from '../components/DietTag';

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
  ingredients?:      string[];
  chefNotes?:        string;
  dietTags?:         Record<string, DietTagData>;
  processingStatus?: string;
  _approved?:        boolean;
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
  code, tag, onChange,
}: {
  code: string; tag?: DietTagData; onChange: (code: string, updated: DietTagData) => void;
}) {
  const state     = getDietState(tag);
  const notes     = tag?.notes ?? '';
  const color     = (DIET_COLORS as Record<string, string>)[code] ?? Colors.textMuted;
  const showNotes = state === 'mod' || notes.trim().length > 0;

  function setDietState(next: DietState) {
    onChange(code, { native: next === 'native', mod: next === 'mod', notes: next === 'none' ? '' : notes });
  }

  return (
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
  );
}

const dc = StyleSheet.create({
  row:              { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  left:             { width: 170, flexShrink: 0 },
  right:            { flex: 1 },
  badgeRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  circle:           { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  badge:            { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  code:             { fontFamily: Fonts.bodyMedium, fontSize: 11, letterSpacing: 0.5 },
  toggleRow:        { flexDirection: 'row', gap: 6 },
  toggle:           { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1, borderColor: Colors.border },
  toggleText:       { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  toggle_native:    { backgroundColor: 'rgba(124,184,122,0.15)', borderColor: '#7cb87a' },
  toggleText_native:{ color: '#7cb87a' },
  toggle_mod:       { backgroundColor: 'rgba(212,168,67,0.15)', borderColor: '#d4a843' },
  toggleText_mod:   { color: '#d4a843' },
  toggle_none:      { backgroundColor: 'rgba(201,107,107,0.15)', borderColor: '#c96b6b' },
  toggleText_none:  { color: '#c96b6b' },
  notes:            { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, padding: 10, fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 20, minHeight: 44 },
  noNotes:          { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, paddingTop: 4 },
});

// ── Swap parsing (ported from ShopScreen) ─────────────────────────────────────

function parseSwapPairs(notes: string): Array<{ from: string; to: string | null }> {
  const result: Array<{ from: string; to: string | null }> = [];
  const s = notes.toLowerCase();
  let m: RegExpExecArray | null;

  const insteadRe = /use\s+(.+?)\s+instead\s+of\s+(.+?)(?:[,.]|$)/gi;
  while ((m = insteadRe.exec(s)) !== null) {
    result.push({ from: m[2].trim(), to: m[1].trim() });
  }

  const replaceRe = /replace\s+(.+?)\s+with\s+(.+?)(?:[,.]|$)/gi;
  while ((m = replaceRe.exec(s)) !== null) {
    const to = m[2].trim();
    m[1].split(/\s+and\s+/i).forEach(f => result.push({ from: f.trim(), to }));
  }

  const removeRe = /remove\s+([^,.\n]+)/gi;
  while ((m = removeRe.exec(s)) !== null) {
    result.push({ from: m[1].trim(), to: null });
  }

  const skipRe = /(?:skip|omit)\s+([^,.\n]+)/gi;
  while ((m = skipRe.exec(s)) !== null) {
    result.push({ from: m[1].split(',')[0].trim(), to: null });
  }

  return result;
}

function fuzzyMatch(term: string, name: string): boolean {
  const clean = (x: string) =>
    x.replace(/\b(cloves?|heads?|tbsp\s+of|tsp\s+of|cups?\s+of|\bof\b)\b/g, '')
     .replace(/\s+/g, ' ').trim();
  const a = clean(term);
  const b = clean(name);
  return b.includes(a) || a.includes(b);
}

// ── Shopping list ─────────────────────────────────────────────────────────────

type IngItem = {
  qty: number; unit: string; name: string; category: string;
  _type: 'normal' | 'swap' | 'crossed';
  _swapFor?: string;    // for 'swap': ingredient this replaces
  _swapTo?:  string;    // for 'crossed': what it was replaced with
  _protocol?: string;
  _color?:    string;
};

function ShoppingList({
  ingredients, dietTags, activeDietFilter,
}: {
  ingredients: string[];
  dietTags?: Record<string, DietTagData>;
  activeDietFilter: Set<string>;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Parse all ingredients into base items
  const baseItems = useMemo((): { qty: number; unit: string; name: string; category: string }[] => {
    return ingredients
      .filter(r => r.trim())
      .map(raw => {
        const p = parseIngredient(raw);
        return p.name ? { qty: p.qty ?? 0, unit: p.unit ?? '', name: p.name, category: p.category || 'pantry-staples' } : null;
      })
      .filter(Boolean) as { qty: number; unit: string; name: string; category: string }[];
  }, [ingredients]);

  // Build swap map from active diet modification notes
  const swapMap = useMemo((): Map<string, { to: string | null; protocol: string; color: string }> => {
    if (activeDietFilter.size === 0 || !dietTags) return new Map();
    const map = new Map<string, { to: string | null; protocol: string; color: string }>();
    for (const code of activeDietFilter) {
      const notes = dietTags[code]?.notes;
      if (!notes || !dietTags[code]?.mod) continue;
      const color = (DIET_COLORS as Record<string, string>)[code] ?? Colors.gold;
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

    for (const item of baseItems) {
      const cat = item.category || 'pantry-staples';
      if (!map[cat]) map[cat] = [];
      const swapInfo = swapMap.get(item.name);

      if (swapInfo) {
        if (swapInfo.to) {
          // Gold swap row: the replacement
          map[cat].push({ qty: 0, unit: '', name: swapInfo.to, category: cat, _type: 'swap', _swapFor: item.name, _protocol: swapInfo.protocol, _color: swapInfo.color });
        } else {
          // Crossed out: ingredient is removed
          map[cat].push({ ...item, _type: 'crossed', _protocol: swapInfo.protocol, _color: swapInfo.color });
        }
      } else {
        map[cat].push({ ...item, _type: 'normal' });
      }
    }

    return SHOPPING_CATEGORIES.map(c => ({ ...c, items: map[c.key] ?? [] })).filter(c => c.items.length > 0);
  }, [baseItems, swapMap]);

  if (!ingredients.length) {
    return <Text style={sl.empty}>No ingredients — add them in the edit section below</Text>;
  }

  return (
    <View>
      {grouped.map(cat => (
        <View key={cat.key} style={sl.category}>
          <View style={sl.catHeader}>
            <Text style={sl.catLabel}>{cat.label.toUpperCase()}</Text>
            <View style={sl.catBadge}><Text style={sl.catCount}>{cat.items.length}</Text></View>
          </View>
          {cat.items.map((item, i) => {
            const key = `${cat.key}-${i}`;

            // Gold swap row — replacement ingredient
            if (item._type === 'swap') {
              return (
                <View key={key} style={[sl.row, sl.rowSwap]}>
                  <View style={[sl.checkbox, sl.checkboxSwap]}>
                    <Text style={sl.swapIcon}>↑</Text>
                  </View>
                  <View style={sl.rowBody}>
                    <Text style={sl.swapName}>{item.name}</Text>
                    <View style={sl.swapMeta}>
                      <View style={[sl.protocolChip, { borderColor: (item._color ?? Colors.gold) + '88' }]}>
                        <Text style={[sl.protocolText, { color: item._color ?? Colors.gold }]}>{item._protocol}</Text>
                      </View>
                      <Text style={sl.swapSource}>replaces {item._swapFor}</Text>
                    </View>
                  </View>
                </View>
              );
            }

            // Crossed-out row — ingredient removed by diet
            if (item._type === 'crossed') {
              return (
                <View key={key} style={[sl.row, sl.rowCrossed]}>
                  <View style={[sl.checkbox, sl.checkboxCrossed]} />
                  <View style={sl.rowBody}>
                    <Text style={sl.crossedName}>{item.name}</Text>
                    <View style={sl.swapMeta}>
                      <View style={[sl.protocolChip, { borderColor: (item._color ?? Colors.red) + '88' }]}>
                        <Text style={[sl.protocolText, { color: item._color ?? Colors.red }]}>{item._protocol}</Text>
                      </View>
                      <Text style={sl.swapSource}>removed</Text>
                    </View>
                  </View>
                </View>
              );
            }

            // Normal row
            const done = checked[key];
            return (
              <TouchableOpacity
                key={key}
                style={sl.row}
                onPress={() => setChecked(prev => ({ ...prev, [key]: !prev[key] }))}
                activeOpacity={0.7}
              >
                <View style={[sl.checkbox, done && sl.checkboxDone]}>
                  {done && <Text style={sl.checkmark}>✓</Text>}
                </View>
                <Text style={[sl.qty, done && sl.done]}>
                  {item.qty ? fmtQty(item.qty, item.unit, item.category) : item.unit || ''}
                </Text>
                <Text style={[sl.name, done && sl.done]}>{item.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
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
  row:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowSwap:        { backgroundColor: 'rgba(212,168,67,0.07)', borderRadius: 6, paddingHorizontal: 6 },
  rowCrossed:     { backgroundColor: 'rgba(201,107,107,0.07)', borderRadius: 6, paddingHorizontal: 6 },
  checkbox:       { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxDone:   { backgroundColor: Colors.green, borderColor: Colors.green },
  checkboxSwap:   { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  checkboxCrossed:{ borderColor: Colors.red, backgroundColor: Colors.red + '22' },
  checkmark:      { fontSize: 11, color: Colors.bg, fontFamily: Fonts.bodyMedium },
  swapIcon:       { fontSize: 11, color: Colors.gold, fontFamily: Fonts.bodyMedium },
  rowBody:        { flex: 1, gap: 3 },
  qty:            { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textMuted, minWidth: 52 },
  name:           { fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary, flex: 1 },
  swapName:       { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.gold },
  crossedName:    { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, textDecorationLine: 'line-through' },
  swapMeta:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  protocolChip:   { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  protocolText:   { fontFamily: Fonts.bodyMedium, fontSize: 9, letterSpacing: 0.5 },
  swapSource:     { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  done:           { opacity: 0.35, textDecorationLine: 'line-through' },
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
      <ScrollView style={pp.scroll} contentContainerStyle={pp.content}>

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
            {local.url ? <Text style={pp.url} numberOfLines={1}>{local.url}</Text> : null}
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
            dietTags={local.dietTags}
            activeDietFilter={activeDiet}
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
      const snap = await getDocs(
        query(collection(db, 'recipes'), where('status', '==', 'needs_review'))
      );
      const docs: RecipeDoc[] = snap.docs.map(d => ({ _id: d.id, ...d.data() } as RecipeDoc));
      setRecipes(docs);
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
          <Text style={s.listCount}>{filtered.length} of {recipes.length} recipes</Text>

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
