import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { AccountSwitcher } from '@/components/account-switcher';
import { AddPeerInput } from '@/components/add-peer-input';
import { InstagramPill } from '@/components/instagram-pill';
import { PeerCard } from '@/components/peer-card';
import { PeerCardSkeleton } from '@/components/peer-card-skeleton';
import { PeerDetail } from '@/components/peer-detail';
import { SwipeRow } from '@/components/swipe-row';
import { SectionHeading, SettingsGear, ThemedScreen } from '@/components/themed-screen';
import { charactersFor } from '@/constants/characters';
import { AppPalette, Type } from '@/constants/theme';
import { useAccounts } from '@/contexts/accounts';
import { useAuth } from '@/contexts/auth';
import { useOnboarding } from '@/contexts/onboarding';
import { usePeers } from '@/contexts/peers';
import { useTheme } from '@/contexts/theme';
import { promptCap } from '@/lib/cap-prompt';
import { classifyAccount } from '@/lib/peer-classify';
import { describeFailure, suggestPeers, type SuggestFailure } from '@/lib/peer-suggest';
import {
  readAccountNiche,
  readOwnScan,
  readSuggestions,
  writeAccountNiche,
  writeSuggestions,
  type AccountNiche,
  type PeerSuggestion,
  type TrackedPeer,
} from '@/lib/peers';

/**
 * The Peers tab. A peer is a ROLE MODEL: same niche, meaningfully bigger, worth
 * studying. It belongs to Statto (blue: Smart Insights).
 *
 * Everything here is scoped to the ACTIVE CONNECTED ACCOUNT, selected with the
 * same pill and switcher the Home tab uses, so two accounts under one login keep
 * separate niches and separate peer lists.
 *
 * The cost model is the design, and it has two cached stages:
 *   classify  once per connected account, ever. One Haiku call over that
 *             account's ALREADY CACHED scan. Never scrapes: a missing scan just
 *             falls back to the onboarding answer.
 *   suggest   once per (niche, subtopic) across ALL users. One Haiku call plus
 *             one batched Apify run.
 * Tracking costs nothing. Only opening a tracked peer can scrape, at most once
 * per 24h per handle, shared by everyone tracking them.
 */
export default function CompetitorsScreen() {
  const { scheme, palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const theme = charactersFor(scheme).statto;
  const { peers, addPeer, addBlocked, removePeer } = usePeers();
  const { activeAccount } = useAccounts();
  const { session } = useAuth();
  const { answers } = useOnboarding();

  const [suggestions, setSuggestions] = useState<PeerSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<{ reason: SuggestFailure; status?: number } | null>(null);
  // The key the suggestions were fetched under. Surfaced in the UI because it is
  // the only way to tell at a glance that two accounts resolved differently.
  const [resolved, setResolved] = useState<AccountNiche | null>(null);
  // True when classification could not run, so the list came from the coarse
  // user-level onboarding answer and is NOT tailored to this account.
  const [usedFallback, setUsedFallback] = useState(false);
  // True when the subtopic found nobody and we widened to the coarse niche, so
  // the list is real but less specific than this account.
  const [broadened, setBroadened] = useState(false);
  const [open, setOpen] = useState<TrackedPeer | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const uid = session?.user?.id ?? null;
  const accountHandle = activeAccount?.handle ?? null;

  // Every account fetched this session, not just the last one. A single-handle
  // ref meant toggling A to B to A re-ran the whole pipeline each way, and each
  // run is a Claude call plus possibly an Apify batch.
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid || !accountHandle || attempted.current.has(accountHandle)) return;
    attempted.current.add(accountHandle);
    let mounted = true;

    void (async () => {
      // Clear the previous account's results so nothing bleeds across a switch.
      setSuggestions([]);
      setFailure(null);
      setResolved(null);
      setUsedFallback(false);
      setBroadened(false);

      // 1. The account's niche. Stored classification wins; otherwise derive it
      //    from the account's own cached scan.
      let niche: AccountNiche | null = await readAccountNiche(uid, accountHandle);

      if (!niche) {
        // readOwnScan reads instagram_scans ONLY. Deliberately not
        // scanProfileCached, which would scrape on a miss and bill Apify just to
        // work out what the user posts about.
        const own = await readOwnScan(uid, accountHandle);
        if (own) {
          if (mounted) setLoading(true);
          const outcome = await classifyAccount({
            themes: own.dna?.topThemes ?? [],
            vibe: own.dna?.vibe ?? null,
            formatMix: own.postTypeBreakdown?.percentages ?? null,
            followers: own.stats?.followers ?? null,
          });
          if (!mounted) return;
          if (outcome.ok && outcome.niche) {
            niche = outcome.niche;
            void writeAccountNiche(uid, accountHandle, outcome.niche);
          } else if (!outcome.ok) {
            setFailure({ reason: outcome.reason, status: outcome.status });
          }
        }
      }

      // 2. Fall back to the coarse onboarding answer when classification could
      //    not run. Vaguer, but better than an empty tab.
      if (!niche && typeof answers.niche === 'string' && answers.niche) {
        niche = { niche: answers.niche, subtopic: '' };
        // Flagged so the UI can admit these are generic. The onboarding answer
        // is user-level, so EVERY account falls back to the same one, which is
        // exactly how "switching accounts changes nothing" happens.
        if (mounted) setUsedFallback(true);
      }
      if (!niche) {
        if (mounted) setLoading(false);
        return;
      }

      if (mounted) setResolved(niche);

      // 3. Suggestions, shared globally per (niche, subtopic).
      // `null` is a miss; an empty ARRAY is a cached "we looked and found
      // nobody", which must count as a hit. Treating empty as a miss is what
      // made a barren subtopic re-run the whole pipeline on every single visit.
      const cached = await readSuggestions(niche.niche, niche.subtopic);
      if (cached) {
        if (mounted) {
          setSuggestions(cached);
          setLoading(false);
        }
        return;
      }

      if (mounted) setLoading(true);
      const own = await readOwnScan(uid, accountHandle);
      const outcome = await suggestPeers({
        niche: niche.niche,
        subtopic: niche.subtopic,
        subtopics: Array.isArray(answers.niche_subtopics)
          ? (answers.niche_subtopics as string[])
          : [],
        themes: own?.dna?.topThemes ?? [],
        vibe: own?.dna?.vibe ?? null,
        followers: own?.stats?.followers ?? null,
      });
      if (!mounted) return;
      setLoading(false);

      if (!outcome.ok) {
        // Keep the add-your-own fallback, but say WHY rather than implying the
        // niche had no matches. A stale backend and an empty niche look
        // identical otherwise.
        setFailure({ reason: outcome.reason, status: outcome.status });
        return;
      }

      setFailure(null);

      // A specific subtopic can be TOO specific: the model may know no
      // well-known bigger accounts in it (relationship_psychology returned zero
      // six times running). Retry once at the coarse niche rather than showing
      // an empty tab. Broader but real beats precise but absent.
      let list = outcome.suggestions;
      if (list.length === 0 && niche.subtopic) {
        const coarse = await suggestPeers({
          niche: niche.niche,
          subtopic: '',
          themes: own?.dna?.topThemes ?? [],
          vibe: own?.dna?.vibe ?? null,
          followers: own?.stats?.followers ?? null,
        });
        if (!mounted) return;
        if (coarse.ok && coarse.suggestions.length) {
          list = coarse.suggestions;
          if (mounted) setBroadened(true);
        }
      }

      setSuggestions(list);
      // Cache the result even when it is EMPTY, under the subtopic key. An
      // uncached empty answer is retried on every visit forever, and each retry
      // costs a Claude call. A stale empty row is far cheaper than that loop,
      // and the coarse retry above makes a genuinely empty result rare.
      void writeSuggestions(niche.niche, niche.subtopic, list);
    })();

    return () => {
      mounted = false;
    };
  }, [uid, accountHandle, answers.niche, answers.niche_subtopics]);

  const tracked = new Set(peers.map((p) => p.handle));
  const untracked = suggestions.filter((s) => !tracked.has(s.handle));

  const track = (s: PeerSuggestion) => {
    const result = addPeer(s.handle, {
      displayName: s.displayName,
      avatarUrl: s.avatarUrl,
      followerCount: s.followerCount,
    });
    if (result === 'needs-auth' || result === 'limit') promptCap('peer', result);
  };

  const showAddYourOwn = !loading && untracked.length === 0;

  return (
    <ThemedScreen
      character="statto"
      header={
        <>
          <InstagramPill
            theme={theme}
            account={activeAccount}
            onPress={() => setSwitcherOpen(true)}
          />
          <SettingsGear />
        </>
      }>
      {peers.length > 0 ? (
        <>
          <SectionHeading>MY PEERS</SectionHeading>
          {peers.map((p) => (
            <SwipeRow
              key={p.handle}
              onDelete={() => removePeer(p.handle)}
              confirmTitle={`Stop tracking @${p.handle}?`}
              confirmMessage={`This removes them from ${
                activeAccount ? `@${activeAccount.handle}` : 'this account'
              } only. You can track them again from the suggestions.`}>
              <PeerCard
                handle={p.handle}
                displayName={p.displayName}
                avatarUrl={p.avatarUrl}
                followerCount={p.followerCount}
                action="open"
                onPress={() => setOpen(p)}
              />
            </SwipeRow>
          ))}
        </>
      ) : null}

      {loading ? (
        <>
          <SectionHeading>SUGGESTED FOR YOU</SectionHeading>
          <Text style={styles.muted}>Finding creators worth studying…</Text>
          <PeerCardSkeleton count={3} />
        </>
      ) : null}

      {/* Rendered OUTSIDE the add-your-own block on purpose: a classify or
          suggest failure used to be invisible whenever suggestions still
          rendered, so a stale backend quietly served generic results. */}
      {!loading && failure ? (
        <Text style={styles.warn}>{describeFailure(failure.reason, failure.status)}</Text>
      ) : null}

      {!loading && usedFallback ? (
        <Text style={styles.warn}>
          These are for your onboarding niche, not this account specifically.
        </Text>
      ) : null}

      {untracked.length > 0 ? (
        <>
          <SectionHeading>SUGGESTED FOR YOU</SectionHeading>
          {resolved ? (
            <Text style={styles.muted}>
              {broadened
                ? `No matches for ${resolved.subtopic}, showing broader ${resolved.niche} picks`
                : resolved.subtopic
                  ? `${resolved.niche} / ${resolved.subtopic}`
                  : resolved.niche}
            </Text>
          ) : null}
          {untracked.map((s) => (
            <PeerCard
              key={s.handle}
              handle={s.handle}
              displayName={s.displayName}
              avatarUrl={s.avatarUrl}
              followerCount={s.followerCount}
              why={s.why}
              action="track"
              onPress={() => track(s)}
            />
          ))}
        </>
      ) : null}

      {showAddYourOwn ? (
        <>
          <SectionHeading>ADD YOUR OWN</SectionHeading>
          <Text style={styles.muted}>
            {failure
              ? 'Add the accounts you look up to in the meantime.'
              : peers.length > 0
                ? 'Know someone else worth watching? Add them by handle.'
                : 'We could not find matches in your niche. Add the accounts you look up to.'}
          </Text>
          <AddPeerInput
            onAdd={(peer) => {
              if (addBlocked) {
                promptCap('peer', addBlocked);
                return;
              }
              track(peer);
            }}
          />
        </>
      ) : null}

      <PeerDetail peer={open} onClose={() => setOpen(null)} onUntrack={removePeer} />
      <AccountSwitcher visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </ThemedScreen>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    muted: {
      ...(Type.body as TextStyle),
      color: palette.muted,
      fontSize: 13,
    },
    warn: {
      ...(Type.body as TextStyle),
      color: palette.warn,
      fontSize: 13,
    },
  });
