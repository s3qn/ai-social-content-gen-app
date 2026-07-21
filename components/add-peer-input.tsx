import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';

import { AccentPill } from '@/components/accent-pill';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import { describeFailure, verifyHandles } from '@/lib/peer-suggest';
import type { PeerSuggestion } from '@/lib/peers';

/**
 * Type-your-own peer entry, the fallback when we have no suggestions for a
 * niche (narrow or local niches have no well-known big accounts to name).
 *
 * The handle is VERIFIED against Instagram before it is handed back, so a typo
 * never becomes a tracked peer. Verification is the batch details-only path, so
 * it costs one Apify run and no LLM call. There is deliberately no autocomplete
 * and no handle directory here.
 */
export function AddPeerInput({ onAdd }: { onAdd: (peer: PeerSuggestion) => void }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const typed = handle.trim().replace(/^@/, '');
    if (!typed || busy) return;
    setBusy(true);
    setError(null);

    const outcome = await verifyHandles([typed]);
    setBusy(false);

    // Distinguish "Instagram has no such account" from "we could not ask".
    // Blaming the user's spelling for a dead backend is how a config problem
    // masquerades as a product bug.
    if (!outcome.ok) {
      setError(describeFailure(outcome.reason, outcome.status));
      return;
    }
    const [found] = outcome.suggestions;
    if (!found) {
      setError(`We could not find @${typed} on Instagram. Check the spelling.`);
      return;
    }
    setHandle('');
    onAdd(found);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.prefix}>@</Text>
        <TextInput
          style={styles.input}
          value={handle}
          onChangeText={setHandle}
          onSubmitEditing={submit}
          placeholder="theirhandle"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          editable={!busy}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <AccentPill label={busy ? 'Checking…' : 'Add peer'} onPress={submit} />
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.md },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
    },
    prefix: {
      ...(Type.body as TextStyle),
      color: palette.muted,
    },
    input: {
      ...(Type.body as TextStyle),
      flex: 1,
      color: palette.ink,
      paddingVertical: Spacing.md,
    },
    error: {
      ...(Type.caption as TextStyle),
      color: palette.warn,
    },
  });
