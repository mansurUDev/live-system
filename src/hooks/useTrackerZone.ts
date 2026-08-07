import { useMediaQuery } from './useMediaQuery'

export type Zone = 'phone' | 'laptop' | 'wide'

/**
 * Три зоны раскладки трекера — не путать с useIsMobile (979px), тот про нижнюю
 * навигацию. phone ⊂ mobile (760 < 979): нижний док никогда не рендерится там,
 * где под ним нет BottomNav.
 */
export function useTrackerZone(): Zone {
  const phone = useMediaQuery('(max-width: 759.98px)')
  const wide = useMediaQuery('(min-width: 1800px)')
  return phone ? 'phone' : wide ? 'wide' : 'laptop'
}
