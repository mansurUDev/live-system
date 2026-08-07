import { useMediaQuery } from './useMediaQuery'

const QUERY = '(max-width: 979px)'

/** Узкий экран: панель сектора превращается в нижнюю шторку, снизу есть BottomNav */
export function useIsMobile(): boolean {
  return useMediaQuery(QUERY)
}
