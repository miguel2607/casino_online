const PALETTES = {
  orange: { fur: '#f6a04d', shade: '#e0863a', patch: '#d9772a' },
  gray: { fur: '#a3acc0', shade: '#8a94aa', patch: '#7a8399' },
  black: { fur: '#3b3349', shade: '#2c2638', patch: '#241f2e' },
  white: { fur: '#fbf6ee', shade: '#ece2d4', patch: '#e3d6c4' },
  calico: { fur: '#fbf6ee', shade: '#ece2d4', patch: '#f19a4c', patch2: '#3b3349' },
  cream: { fur: '#f3d9b1', shade: '#e6c293', patch: '#dcae78' },
};

export const CAT_COLORS = Object.keys(PALETTES);

const INK = '#2b2238';

function Eyes({ mood, dark }) {
  const shine = '#fff';
  const ink = dark ? '#f7e27c' : INK;
  const open = (cx) => (
    <g key={cx}>
      <ellipse cx={cx} cy="61" rx="6.5" ry="8" fill={ink} />
      {dark && <ellipse cx={cx} cy="61" rx="2.2" ry="6.5" fill={INK} />}
      <circle cx={cx + 2} cy="58" r="2.2" fill={shine} />
    </g>
  );
  const closed = (cx) => (
    <path key={cx} d={`M${cx - 7} 62 Q${cx} 53 ${cx + 7} 62`} stroke={ink} strokeWidth="4.5" fill="none" strokeLinecap="round" />
  );
  const heart = (cx) => (
    <path
      key={cx}
      d={`M${cx} 67 C${cx - 10} 60 ${cx - 7} 52 ${cx} 56.5 C${cx + 7} 52 ${cx + 10} 60 ${cx} 67 Z`}
      fill="#ff4f8b"
    />
  );
  const sad = (cx, dir) => (
    <g key={cx}>
      <ellipse cx={cx} cy="62" rx="6" ry="7" fill={ink} />
      <circle cx={cx + 2} cy="59.5" r="2" fill={shine} />
      <path d={`M${cx - 8} ${dir > 0 ? 51 : 54} L${cx + 7} ${dir > 0 ? 54 : 51}`} stroke={ink} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
  const shocked = (cx) => (
    <g key={cx}>
      <circle cx={cx} cy="61" r="8" fill="#fff" stroke={INK} strokeWidth="2" />
      <circle cx={cx} cy="61" r="3.5" fill={INK} />
    </g>
  );

  switch (mood) {
    case 'happy': return <>{closed(43)}{closed(77)}</>;
    case 'love': return <>{heart(43)}{heart(77)}</>;
    case 'wink': return <>{open(43)}{closed(77)}</>;
    case 'sad': return <>{sad(43, -1)}{sad(77, 1)}</>;
    case 'shocked': return <>{shocked(43)}{shocked(77)}</>;
    case 'sleepy': return (
      <>
        <path d="M36 62 Q43 66 50 62" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M70 62 Q77 66 84 62" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    );
    default: return <>{open(43)}{open(77)}</>;
  }
}

function Mouth({ mood }) {
  if (mood === 'sad') {
    return <path d="M52 84 Q60 78 68 84" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
  }
  if (mood === 'shocked') return <ellipse cx="60" cy="83" rx="4.5" ry="5.5" fill={INK} />;
  if (mood === 'happy' || mood === 'love') {
    return (
      <g>
        <path d="M51 78 Q55.5 83 60 78 Q64.5 83 69 78" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M55 81 Q60 91 65 81 Z" fill="#ff7ea8" />
      </g>
    );
  }
  return <path d="M51 78 Q55.5 83 60 78 Q64.5 83 69 78" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
}

/**
 * Carita de michi en SVG.
 * mood: normal | happy | love | wink | sad | shocked | sleepy
 */
export default function Cat({ color = 'orange', mood = 'normal', size = 64, accessory, className = '', title }) {
  const p = PALETTES[color] || PALETTES.orange;
  const dark = color === 'black';
  return (
    <svg
      viewBox="0 0 120 110"
      width={size}
      height={typeof size === 'number' ? (size * 110) / 120 : undefined}
      className={`cat ${className}`}
      role="img"
      aria-label={title || 'michi'}
    >
      <polygon points="14,52 25,5 55,30" fill={p.fur} stroke={p.shade} strokeWidth="2" strokeLinejoin="round" />
      <polygon points="106,52 95,5 65,30" fill={color === 'calico' ? p.patch : p.fur} stroke={p.shade} strokeWidth="2" strokeLinejoin="round" />
      <polygon points="23,41 28,18 44,31" fill="#ffb8cc" />
      <polygon points="97,41 92,18 76,31" fill="#ffb8cc" />
      <ellipse cx="60" cy="64" rx="48" ry="40" fill={p.fur} />
      {color === 'calico' && (
        <>
          <path d="M72 26 Q102 28 106 58 Q92 48 76 50 Q70 40 72 26 Z" fill={p.patch} />
          <path d="M18 74 Q22 94 40 100 Q34 86 30 72 Z" fill={p.patch2} />
        </>
      )}
      {(color === 'orange' || color === 'gray' || color === 'cream') && (
        <g stroke={p.patch} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M60 26 L60 38" />
          <path d="M50 28 L52 38" />
          <path d="M70 28 L68 38" />
        </g>
      )}
      <ellipse cx="60" cy="80" rx="20" ry="13" fill={dark ? '#4a4159' : '#fff8f2'} opacity={dark ? 1 : 0.85} />
      <ellipse cx="29" cy="76" rx="8" ry="5" fill="#ff8fb1" opacity="0.45" />
      <ellipse cx="91" cy="76" rx="8" ry="5" fill="#ff8fb1" opacity="0.45" />
      <Eyes mood={mood} dark={dark} />
      <path d="M55.5 71 L64.5 71 L60 76.5 Z" fill="#ff7ea8" strokeLinejoin="round" />
      <Mouth mood={mood} />
      <g stroke={dark ? '#8a809b' : '#b7a99a'} strokeWidth="1.8" strokeLinecap="round">
        <path d="M10 70 L34 74" />
        <path d="M10 80 L34 79" />
        <path d="M110 70 L86 74" />
        <path d="M110 80 L86 79" />
      </g>
      {accessory === 'crown' && (
        <path d="M40 22 L46 6 L54 18 L60 2 L66 18 L74 6 L80 22 Z" fill="#ffd166" stroke="#e0a930" strokeWidth="2" strokeLinejoin="round" />
      )}
      {accessory === 'bow' && (
        <g transform="translate(84 22) rotate(18)">
          <path d="M0 0 L-14 -9 L-14 9 Z M0 0 L14 -9 L14 9 Z" fill="#ff5d9e" />
          <circle r="4" fill="#ff86b6" />
        </g>
      )}
    </svg>
  );
}
