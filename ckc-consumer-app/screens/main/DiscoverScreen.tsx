/**
 * DiscoverScreen
 *
 * Tab 1. The primary recipe discovery experience.
 *
 * Layout:
 *   ─ Header (CKC wordmark)
 *   ─ Protocol filter chips (horizontal scroll)
 *   ─ Active secondary filter pill (cuisine / prep-time, clearable)
 *   ─ Swipe card stack (PanResponder-powered)
 *   ─ Action buttons (pass / save / view)
 *   ─ Browse section (cuisine + prep-time tiles that filter the stack)
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Colors, Fonts } from '../../constants/theme';
import { useUser } from '../../context/UserContext';
import { useMenu } from '../../context/MenuContext';
import {
  SAMPLE_RECIPES,
  Recipe,
  filterByProtocol,
  getComplianceStatus,
} from '../../data/sampleRecipes';
import DietTag, { DIET_COLORS } from '../components/DietTag';
import { fetchRecipes } from '../../lib/firestore';
import { normalizeProtein, formatRating } from '../../lib/ingredientParser';

const SIDEBAR_WIDTH = 220; // desktop sidebar width (matches MainTabs)
const MAX_CARD_WIDTH = 420; // cap card width on wide screens
const SWIPE_LIMIT = 10;
const SWIPE_STORAGE_KEY = 'ckc_swipe_data';

// Protocol keys for the filter row (All handled separately)
const PROTOCOL_FILTER_KEYS = ['GF', 'DF', 'LF', 'K', 'AIP', 'V', 'Vg', 'LH'];

// ── Browse categories — prep time only (cuisine comes from profile) ───────────

type BrowseCategory = {
  label: string;
  emoji: string;
  filterType: 'prepTime';
  filterValue: string;
};

const BROWSE_CATEGORIES: BrowseCategory[] = [
  { label: 'Under 30 Min', emoji: '', filterType: 'prepTime', filterValue: 'quick' },
  { label: '30–60 Min',    emoji: '', filterType: 'prepTime', filterValue: 'medium' },
  { label: '60+ Min',      emoji: '', filterType: 'prepTime', filterValue: 'long' },
];

// ── Multi-dimensional filter ──────────────────────────────────────────────────

function filterRecipes(
  recipes: Recipe[],
  protocol: string,
  cuisine: string,
  prepTime: string,
): Recipe[] {
  let results = filterByProtocol(recipes, protocol);

  if (cuisine !== 'all') {
    results = results.filter(r => r.cuisine === cuisine);
  }

  if (prepTime === 'quick') {
    results = results.filter(r => r.prep_time != null && r.prep_time <= 30);
  } else if (prepTime === 'medium') {
    results = results.filter(r => r.prep_time != null && r.prep_time > 30 && r.prep_time <= 60);
  } else if (prepTime === 'long') {
    results = results.filter(r => r.prep_time != null && r.prep_time > 60);
  }

  return results;
}

// ── Compliance badge — wraps shared DietTag ───────────────────────────────────

function ComplianceBadge({
  protocol,
  status,
}: {
  protocol: string;
  status: 'native' | 'modified' | 'none';
}) {
  if (status === 'none') return null;
  return <DietTag protocol={protocol} variant="circle" status={status === 'modified' ? 'modified' : 'native'} />;
}

// ── Static background card ────────────────────────────────────────────────────

function RecipeCardStatic({ recipe, offset, cardWidth, cardHeight }: { recipe: Recipe; offset: number; cardWidth: number; cardHeight: number }) {
  const scale = 1 - offset * 0.04;
  const translateY = offset * 10;

  return (
    <View style={[
      styles.card,
      { width: cardWidth, height: cardHeight },
      {
        transform: [{ scale }, { translateY }],
        zIndex: 10 - offset,
        position: 'absolute',
      },
    ]}>
      <View style={[styles.cardPhoto, { height: cardHeight * 0.58, backgroundColor: recipe.placeholder_color }]}>
        {recipe.photo_url ? (
          <Image source={{ uri: recipe.photo_url }} style={styles.cardImage} />
        ) : null}
      </View>
    </View>
  );
}

// ── Swipeable top card ────────────────────────────────────────────────────────

interface SwipeCardProps {
  recipe: Recipe;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onTap: () => void;
  activeProtocols: string[];
  cardWidth: number;
  cardHeight: number;
  screenWidth: number;
}

function SwipeCard({ recipe, onSwipeLeft, onSwipeRight, onTap, activeProtocols, cardWidth, cardHeight, screenWidth }: SwipeCardProps) {
  const position = useRef(new Animated.ValueXY()).current;
  const tapped    = useRef(false);

  const swipeThreshold = screenWidth * 0.35;

  const rotate = position.x.interpolate({
    inputRange:  [-screenWidth / 2, 0, screenWidth / 2],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  const saveOpacity = position.x.interpolate({
    inputRange:  [0, swipeThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = position.x.interpolate({
    inputRange:  [-swipeThreshold, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  function resetPosition() {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      useNativeDriver: true,
    }).start();
  }

  function flyOff(direction: 'left' | 'right', callback: () => void) {
    const x = direction === 'right' ? screenWidth * 1.4 : -screenWidth * 1.4;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 280,
      useNativeDriver: true,
    }).start(callback);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { tapped.current = true; },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) {
          tapped.current = false;
        }
        position.setValue({ x: g.dx, y: g.dy * 0.3 });
      },
      onPanResponderRelease: (_, g) => {
        if (tapped.current) {
          resetPosition();
          onTap();
          return;
        }
        if (g.dx > swipeThreshold) {
          flyOff('right', onSwipeRight);
        } else if (g.dx < -swipeThreshold) {
          flyOff('left', onSwipeLeft);
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  // Show badges for active protocols, or all 8 if no protocol filter active
  const protocolKeys = activeProtocols.length > 0 ? activeProtocols : Object.keys(DIET_COLORS);
  const badges = protocolKeys
    .map(p => ({ p, status: getComplianceStatus(recipe, p) }))
    .filter(b => b.status !== 'none')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'native' ? -1 : 1;
      return a.p.localeCompare(b.p);
    })
    .slice(0, 5);

  return (
    <Animated.View
      style={[
        styles.card,
        styles.cardTop,
        { width: cardWidth, height: cardHeight, transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Photo / color placeholder */}
      <View style={[styles.cardPhoto, { height: cardHeight * 0.58, backgroundColor: recipe.placeholder_color }]}>
        {recipe.photo_url ? (
          <Image source={{ uri: recipe.photo_url }} style={styles.cardImage} />
        ) : null}
        <Animated.View style={[styles.swipeOverlay, styles.overlayRight, { opacity: saveOpacity }]}>
          <Text style={styles.overlayText}>SAVE</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeOverlay, styles.overlayLeft, { opacity: passOpacity }]}>
          <Text style={styles.overlayText}>PASS</Text>
        </Animated.View>
        {recipe.prep_time ? (
          <View style={styles.prepTimePill}>
            <Text style={styles.prepTimeText}>{recipe.prep_time} min</Text>
          </View>
        ) : null}
      </View>

      {/* Card body */}
      <View style={styles.cardBody}>
        <View style={styles.cardMeta}>
          <Text style={styles.cuisineTag}>{recipe.cuisine}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.proteinTag}>{recipe.protein_type}</Text>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{recipe.name}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{recipe.menu_description}</Text>

        {(recipe.blogger || formatRating(recipe.rating)) ? (
          <View style={styles.cardAttribution}>
            {recipe.blogger ? <Text style={styles.cardBlogger}>{recipe.blogger}</Text> : null}
            {recipe.blogger && formatRating(recipe.rating) ? (
              <Text style={styles.cardRatingSep}>·</Text>
            ) : null}
            {formatRating(recipe.rating) ? (
              <Text style={styles.cardRating}>★ {formatRating(recipe.rating)}</Text>
            ) : null}
          </View>
        ) : null}

        {badges.length > 0 && (
          <View style={styles.badgeRow}>
            {badges.map(b => (
              <ComplianceBadge key={b.p} protocol={b.p} status={b.status} />
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const { profile, saveRecipe } = useUser();
  const { addToMenu, removeFromMenu, isInMenu } = useMenu();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // View mode toggle
  const [viewMode, setViewMode] = useState<'swipe' | 'list'>('swipe');
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic card sizing — constrained by both width and available height
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && windowWidth >= 900;
  const availableWidth = isDesktop ? windowWidth - SIDEBAR_WIDTH : windowWidth;
  // Other UI elements consume ~270px on desktop (no tab bar), ~310px on mobile
  const otherUI = isDesktop ? 270 : 310;
  const maxCardHeightByScreen = windowHeight - otherUI;
  const cardWidthByWidth  = Math.min(availableWidth - 48, MAX_CARD_WIDTH);
  const cardWidthByHeight = maxCardHeightByScreen / 1.28;
  const cardWidth  = Math.min(cardWidthByWidth, cardWidthByHeight);
  const cardHeight = cardWidth * 1.28;

  // Recipe source — Firestore with sampleRecipes fallback
  const [allRecipes, setAllRecipes] = useState<Recipe[]>(
    SAMPLE_RECIPES.filter(r => r.meal_type === 'entree'),
  );

  useEffect(() => {
    fetchRecipes(60).then(firestoreRecipes => {
      if (firestoreRecipes.length > 0) {
        setAllRecipes(firestoreRecipes.filter(r => r.meal_type === 'entree'));
      }
    }).catch(() => {});
  }, []);

  // Filter state
  const [activeProtocol, setActiveProtocol] = useState<string>('all');
  const [activeCuisine,  setActiveCuisine]  = useState<string>('all');
  const [activePrepTime, setActivePrepTime]  = useState<string>('all');

  // Diet filter accordion
  const [filterOpen, setFilterOpen] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;

  function toggleFilter() {
    const toValue = filterOpen ? 0 : 1;
    setFilterOpen(v => !v);
    Animated.spring(filterAnim, { toValue, useNativeDriver: false, friction: 7, tension: 60 }).start();
  }

  function selectProtocol(key: string) {
    setActiveProtocol(key);
    setCurrentIndex(0);
    // Close accordion after selection
    setFilterOpen(false);
    Animated.spring(filterAnim, { toValue: 0, useNativeDriver: false, friction: 7, tension: 60 }).start();
  }

  // Card index
  const [currentIndex, setCurrentIndex] = useState(0);

  // Swipe count — persisted daily via AsyncStorage on native
  const [swipeCount, setSwipeCount] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const raw = await AsyncStorage.getItem(SWIPE_STORAGE_KEY);
        if (raw) {
          const { count, date } = JSON.parse(raw);
          if (date === new Date().toDateString()) setSwipeCount(count);
        }
      } catch {}
    })();
  }, []);

  const persistSwipeCount = useCallback(async (newCount: number) => {
    if (Platform.OS === 'web') return;
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem(
        SWIPE_STORAGE_KEY,
        JSON.stringify({ count: newCount, date: new Date().toDateString() }),
      );
    } catch {}
  }, []);

  // Derived: filtered recipe list
  const filteredRecipes = filterRecipes(allRecipes, activeProtocol, activeCuisine, activePrepTime);
  const remainingCards  = filteredRecipes.slice(currentIndex);

  // List mode: search within filtered results
  const listRecipes = (() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return filteredRecipes;
    return filteredRecipes.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.cuisine ?? '').toLowerCase().includes(q) ||
      normalizeProtein(r.protein_type ?? '').toLowerCase().includes(q)
    );
  })();

  // Active secondary filter label (for the clearable pill)
  const secondaryFilterLabel = (() => {
    if (activeCuisine !== 'all') return activeCuisine;
    if (activePrepTime === 'quick')  return 'Under 30 Min';
    if (activePrepTime === 'medium') return '30–60 Min';
    if (activePrepTime === 'long')   return '60+ Min';
    return null;
  })();

  function clearSecondaryFilter() {
    setActiveCuisine('all');
    setActivePrepTime('all');
    setCurrentIndex(0);
  }

  function handleSwipeLeft() {
    const newCount = swipeCount + 1;
    setSwipeCount(newCount);
    persistSwipeCount(newCount);
    setCurrentIndex(i => i + 1);
  }

  function handleSwipeRight() {
    const recipe = filteredRecipes[currentIndex];
    if (recipe) saveRecipe(recipe.id);
    const newCount = swipeCount + 1;
    setSwipeCount(newCount);
    persistSwipeCount(newCount);
    setCurrentIndex(i => i + 1);
  }

  function handleTap() {
    const recipe = filteredRecipes[currentIndex];
    if (recipe) navigation.navigate('RecipeDetail', { recipeId: recipe.id });
  }

  function handleBrowseTap(cat: BrowseCategory) {
    // Toggle: tap the same tile again to clear
    const next = activePrepTime === cat.filterValue ? 'all' : cat.filterValue;
    setActivePrepTime(next);
    setActiveCuisine('all');
    setCurrentIndex(0);
  }

  const atSwipeLimit = swipeCount >= SWIPE_LIMIT && profile.tier === 'free';
  const noMoreCards  = remainingCards.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.wordmark}>CKC</Text>
          <Text style={styles.subline}>Chef-Curated Recipes</Text>
        </View>
        <TouchableOpacity
          style={styles.viewToggle}
          onPress={() => {
            setViewMode(v => v === 'swipe' ? 'list' : 'swipe');
            setSearchQuery('');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.viewToggleText}>
            {viewMode === 'swipe' ? '≡  List' : '⊟  Swipe'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Diet filter accordion ── */}
      <View style={styles.filterRow}>
        {/* All Diets button */}
        <TouchableOpacity
          style={[styles.filterChip, (activeProtocol === 'all' || filterOpen) && styles.filterChipActive]}
          onPress={toggleFilter}
          activeOpacity={0.7}
        >
          <View style={styles.filterChipInner}>
            {activeProtocol !== 'all' && !filterOpen && (
              <View style={styles.filterActiveCircle}>
                <DietTag protocol={activeProtocol} variant="circle" />
              </View>
            )}
            <Text style={[styles.filterChipText, (activeProtocol === 'all' || filterOpen) && styles.filterChipTextActive]}>
              {filterOpen ? 'All Diets ✕' : 'All Diets'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Accordion — slides in to the right */}
        <Animated.View style={[
          styles.filterAccordion,
          {
            maxWidth: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }),
            opacity: filterAnim,
          },
        ]}>
          {/* Reset to all */}
          {activeProtocol !== 'all' && (
            <TouchableOpacity
              style={[styles.filterChip, styles.filterChipActive]}
              onPress={() => selectProtocol('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, styles.filterChipTextActive]}>Clear</Text>
            </TouchableOpacity>
          )}
          {PROTOCOL_FILTER_KEYS.map(key => (
            <TouchableOpacity
              key={key}
              style={[
                styles.filterTagWrap,
                activeProtocol === key && { borderColor: DIET_COLORS[key] ?? Colors.borderActive },
              ]}
              onPress={() => selectProtocol(key)}
              activeOpacity={0.7}
            >
              <DietTag protocol={key} variant="circle" />
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>

      {/* ── Time filter chips ── */}
      <View style={styles.timeFilterRow}>
        {BROWSE_CATEGORIES.map(cat => {
          const isActive = activePrepTime === cat.filterValue;
          return (
            <TouchableOpacity
              key={cat.filterValue}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => handleBrowseTap(cat)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Active secondary filter pill ── */}
      {secondaryFilterLabel && (
        <View style={styles.activeFilterRow}>
          <View style={styles.activeFilterPill}>
            <Text style={styles.activeFilterText}>{secondaryFilterLabel}</Text>
            <TouchableOpacity
              onPress={clearSecondaryFilter}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={styles.activeFilterClear}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.activeFilterCount}>
            {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {viewMode === 'list' ? (
        /* ── List mode ──────────────────────────────────────────────────────── */
        <>
          {/* Search bar */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes…"
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>

          {/* Recipe list */}
          <FlatList
            data={listRecipes}
            keyExtractor={r => r.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.listEmpty}>
                <Text style={styles.listEmptyText}>
                  {searchQuery ? 'No recipes match your search.' : 'No recipes for this filter.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const inMenu = isInMenu(item.id);
              return (
                <TouchableOpacity
                  style={styles.listRow}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
                >
                  {/* Colour thumbnail */}
                  <View style={[styles.listThumb, { backgroundColor: item.placeholder_color }]} />

                  {/* Text */}
                  <View style={styles.listRowBody}>
                    <Text style={styles.listRowTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.listRowMeta} numberOfLines={1}>
                      {item.cuisine}
                      {item.cuisine && item.protein_type ? ' · ' : ''}
                      {normalizeProtein(item.protein_type ?? '')}
                      {item.prep_time ? `  ·  ${item.prep_time} min` : ''}
                    </Text>
                  </View>

                  {/* Add / remove from menu */}
                  <TouchableOpacity
                    style={[styles.addMenuBtn, inMenu && styles.addMenuBtnActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (inMenu) {
                        removeFromMenu(item.id);
                      } else {
                        addToMenu({
                          recipeId: item.id,
                          recipeName: item.name,
                          recipeImage: item.photo_url || undefined,
                        });
                      }
                    }}
                  >
                    <Text style={[styles.addMenuBtnText, inMenu && styles.addMenuBtnTextActive]}>
                      {inMenu ? '✓ Menu' : '+ Menu'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        </>
      ) : (
        /* ── Swipe mode ─────────────────────────────────────────────────────── */
        <>
          {/* Card stack */}
          <View style={styles.cardStack}>
            {atSwipeLimit ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✦</Text>
                <Text style={styles.emptyTitle}>You've hit today's limit</Text>
                <Text style={styles.emptySubtitle}>
                  Upgrade to Premium for unlimited swipes and full recipe discovery.
                </Text>
                <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.85}>
                  <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
                </TouchableOpacity>
              </View>
            ) : noMoreCards ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✓</Text>
                <Text style={styles.emptyTitle}>
                  {secondaryFilterLabel
                    ? `No ${secondaryFilterLabel} recipes`
                    : "You've seen them all"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {secondaryFilterLabel
                    ? 'Try a different category or clear the filter.'
                    : 'Try a different filter or check back as new recipes are added.'}
                </Text>
                {secondaryFilterLabel && (
                  <TouchableOpacity style={styles.clearFilterBtn} onPress={clearSecondaryFilter}>
                    <Text style={styles.clearFilterBtnText}>Clear Filter</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                {remainingCards.length >= 3 && (
                  <RecipeCardStatic recipe={remainingCards[2]} offset={2} cardWidth={cardWidth} cardHeight={cardHeight} />
                )}
                {remainingCards.length >= 2 && (
                  <RecipeCardStatic recipe={remainingCards[1]} offset={1} cardWidth={cardWidth} cardHeight={cardHeight} />
                )}
                <SwipeCard
                  key={`${activeProtocol}-${activeCuisine}-${activePrepTime}-${currentIndex}`}
                  recipe={remainingCards[0]}
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeRight={handleSwipeRight}
                  onTap={handleTap}
                  activeProtocols={activeProtocol === 'all' ? [] : [activeProtocol]}
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  screenWidth={availableWidth}
                />
              </>
            )}
          </View>

          {/* Action buttons */}
          {!atSwipeLimit && !noMoreCards && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.passBtn]}
                onPress={handleSwipeLeft}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnIcon}>✕</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.viewBtn} onPress={handleTap} activeOpacity={0.8}>
                <Text style={styles.viewBtnText}>View Recipe</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.saveBtn]}
                onPress={handleSwipeRight}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnIcon}>♥</Text>
              </TouchableOpacity>
            </View>
          )}

        </>
      )}

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  viewToggle: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  viewToggleText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  wordmark: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  subline: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },

  // Diet filter accordion
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
    overflow: 'hidden',
  },
  filterAccordion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  timeFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterActiveCircle: {
    // tiny selected indicator next to label
  },
  filterChipActive: {
    borderColor: Colors.borderActive,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterChipText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  filterChipTextActive: { color: Colors.textPrimary },
  filterTagWrap: {
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },

  // Active secondary filter pill
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 10,
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: Colors.borderActive,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  activeFilterText: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.textPrimary },
  activeFilterClear: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  activeFilterCount: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },

  // Card stack
  cardStack: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Cards
  card: {
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTop: { position: 'absolute', zIndex: 20 },
  cardPhoto: { position: 'relative', overflow: 'hidden' },
  cardImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  cardBody: { padding: 16, gap: 6, flex: 1 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cuisineTag: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metaDot: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  proteinTag: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  cardTitle: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  cardDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  cardAttribution: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  cardBlogger: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  cardRatingSep: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  cardRating: { fontFamily: Fonts.bodyMedium, fontSize: 11, color: Colors.gold },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },

  // Compliance badges — circles matching original website design
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.3,
  },

  // Swipe overlays
  swipeOverlay: {
    position: 'absolute',
    top: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
  },
  overlayRight: {
    left: 20,
    borderColor: Colors.green,
    backgroundColor: 'rgba(0,0,0,0.4)',
    transform: [{ rotate: '-15deg' }],
  },
  overlayLeft: {
    right: 20,
    borderColor: Colors.red,
    backgroundColor: 'rgba(0,0,0,0.4)',
    transform: [{ rotate: '15deg' }],
  },
  overlayText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: 2,
  },

  // Prep time pill
  prepTimePill: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  prepTimeText: { fontFamily: Fonts.bodyMedium, fontSize: 11, color: Colors.textPrimary },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 16,
  },
  actionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  passBtn: { borderColor: Colors.red, backgroundColor: 'rgba(201,107,107,0.12)' },
  saveBtn: { borderColor: Colors.green, backgroundColor: 'rgba(124,184,122,0.12)' },
  actionBtnIcon: { fontFamily: Fonts.bodyMedium, fontSize: 18, color: Colors.textPrimary },
  viewBtn: {
    flex: 1,
    maxWidth: 160,
    height: 44,
    borderRadius: 100,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.textPrimary },

  // Empty / limit states
  emptyState: { alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIcon: { fontSize: 36, color: Colors.gold },
  emptyTitle: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  upgradeBtn: {
    marginTop: 8,
    backgroundColor: Colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
  },
  upgradeBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: '#000' },
  clearFilterBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.borderActive,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
  },
  clearFilterBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textPrimary },

  // Browse section
  browseSection: { paddingBottom: 8 },
  browseSectionTitle: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  browseTiles: { paddingHorizontal: 20, gap: 8 },
  browseTile: {
    width: 88,
    height: 72,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  browseTileActive: {
    borderColor: Colors.borderActive,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  browseTileEmoji: { fontSize: 22 },
  browseTileLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  browseTileLabelActive: { color: Colors.textPrimary },

  // ── List mode ──────────────────────────────────────────────────────────────
  searchBar: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    flexShrink: 0,
  },
  listRowBody: {
    flex: 1,
    gap: 3,
  },
  listRowTitle: {
    fontFamily: Fonts.display,
    fontSize: 17,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  listRowMeta: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  addMenuBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  addMenuBtnActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  addMenuBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  addMenuBtnTextActive: {
    color: Colors.gold,
  },
  listEmpty: {
    paddingTop: 48,
    alignItems: 'center',
  },
  listEmptyText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
