export type NavigationLinks = { android: string; fallback: string };

export function getNavigationLinks(latitude: number, longitude: number): NavigationLinks {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('The authorized pickup destination is invalid.');
  }
  return {
    android: `google.navigation:q=${latitude},${longitude}`,
    fallback: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  };
}

export async function openPickupNavigation(
  latitude: number,
  longitude: number,
  opener: { canOpenURL: (url: string) => Promise<boolean>; openURL: (url: string) => Promise<unknown> },
): Promise<'android' | 'fallback'> {
  const links = getNavigationLinks(latitude, longitude);
  try {
    if (await opener.canOpenURL(links.android)) {
      await opener.openURL(links.android);
      return 'android';
    }
  } catch { /* Use the generic map link when the Android navigation intent is unavailable. */ }
  await opener.openURL(links.fallback);
  return 'fallback';
}
