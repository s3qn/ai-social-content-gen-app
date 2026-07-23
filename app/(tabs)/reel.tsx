import { useEffect, useState } from 'react';

import { AccentPill } from '@/components/accent-pill';
import { playCreateOverlay } from '@/components/create-overlay';
import { PostAnalysisModal } from '@/components/post-analysis-modal';
import { RelatedPosts } from '@/components/related-posts';
import {
  HeaderTitle,
  SectionHeading,
  SettingsGear,
  ThemedScreen,
} from '@/components/themed-screen';
import { TrendingPanel } from '@/components/trending-panel';
import { useAccounts } from '@/contexts/accounts';
import { useAuth } from '@/contexts/auth';
import { useOnboarding } from '@/contexts/onboarding';
import { readAccountNiche } from '@/lib/peers';
import type { RelatedPost } from '@/lib/related';

// The Trends tab belongs to Spark (yellow: Momentum).
export default function ReelScreen() {
  const { session } = useAuth();
  const { activeAccount } = useAccounts();
  const { answers } = useOnboarding();

  const uid = session?.user?.id ?? null;
  const accountHandle = activeAccount?.handle ?? null;

  // The active account's stored classification wins; without one (or without an
  // account at all) fall back to the coarse user-level onboarding answer. Kept
  // deliberately read-only: this screen never classifies and never scrapes.
  const [resolved, setResolved] = useState<{ niche: string | null; subtopic: string | null }>({
    niche: null,
    subtopic: null,
  });
  // Related posts open the same analysis modal the trending panel uses.
  // RelatedPost is field-compatible with TrendingPost by construction.
  const [openPost, setOpenPost] = useState<RelatedPost | null>(null);

  useEffect(() => {
    let mounted = true;
    const fallbackNiche = typeof answers.niche === 'string' && answers.niche ? answers.niche : null;

    void (async () => {
      if (uid && accountHandle) {
        const stored = await readAccountNiche(uid, accountHandle);
        if (!mounted) return;
        if (stored) {
          setResolved({ niche: stored.niche, subtopic: stored.subtopic || null });
          return;
        }
      }
      if (mounted) setResolved({ niche: fallbackNiche, subtopic: null });
    })();

    return () => {
      mounted = false;
    };
  }, [uid, accountHandle, answers.niche]);

  return (
    <ThemedScreen
      character="spark"
      header={
        <>
          <HeaderTitle title="Trends" />
          <SettingsGear />
        </>
      }>
      {/* Renders its own GLOBAL TRENDS heading, plus the Biggest/Rising tabs.
          Reads the shared trending cache only: it never triggers a scrape. */}
      <TrendingPanel />

      <SectionHeading>RELATED TO YOU</SectionHeading>
      <RelatedPosts
        niche={resolved.niche}
        subtopic={resolved.subtopic}
        onOpenPost={setOpenPost}
      />

      <AccentPill label="Add as Idea" onPress={() => playCreateOverlay()} />

      <PostAnalysisModal post={openPost} onClose={() => setOpenPost(null)} />
    </ThemedScreen>
  );
}
