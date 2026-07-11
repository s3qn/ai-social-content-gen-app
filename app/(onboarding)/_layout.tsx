import { Stack } from 'expo-router';

// Headerless onboarding group, modeled on app/(auth)/_layout.tsx. The single
// `step` driver screen walks the config-driven step engine and owns its own
// progress bar + back button. (Named `step`, not `index`, because a group index
// would collide with the app's root `/` route in app/index.tsx.)
export const unstable_settings = {
  initialRouteName: 'step',
};

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="step" />
    </Stack>
  );
}
