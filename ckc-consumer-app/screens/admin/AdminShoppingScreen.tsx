/**
 * AdminShoppingScreen
 *
 * Renders the shopping list admin tool in an iframe.
 * Auto-logs in via postMessage so the user doesn't see a second login prompt
 * after already passing the admin password gate.
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

export default function AdminShoppingScreen() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Once the iframe loads, auto-fill and submit the login form
  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      const loginScreen = doc.getElementById('login-screen');
      // Already logged in (hidden) or no login screen — do nothing
      if (!loginScreen || loginScreen.style.display === 'none') return;

      const userInput = doc.getElementById('login-user') as HTMLInputElement | null;
      const passInput = doc.getElementById('login-pass') as HTMLInputElement | null;
      const loginBtn  = doc.getElementById('login-btn') as HTMLButtonElement | null;

      if (userInput) userInput.value = 'admin';
      if (passInput) passInput.value = 'prince';
      if (loginBtn)  loginBtn.click();
    } catch {
      // Cross-origin — unlikely since both are same origin, but ignore if so
    }
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        {/* @ts-ignore — iframe + ref valid on web */}
        <iframe
          ref={iframeRef}
          src="/admin-static/shopping.html"
          style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
          title="Shopping List"
          onLoad={handleLoad}
        />
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.msg}>Shopping list is available on web only.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  msg:    { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
});
