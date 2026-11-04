/** Phone layout: narrow screens, plus phones held sideways (short, touch-first). iPad and desktop keep the full layout. */
export const PHONE_QUERY = '(max-width: 767px), (max-height: 520px) and (pointer: coarse)'
export const isPhone = () => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches
