import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

// The ORIGINAL animated mascot from assets/images/virlo-wave.svg: SMIL
// (bob / leaf sway / blink / arm wave) + the CSS @keyframes pop are kept intact.
// react-native-svg can't run these, but a WebView (WebKit) does, so the mascot
// animates itself with no Reanimated involved.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 430" width="420" height="430" role="img" aria-label="Virlo waving hello">
<style>
#pop{transform-origin:210px 420px;animation:pop .65s cubic-bezier(.34,1.6,.64,1) both}
@keyframes pop{0%{transform:scale(0)}70%{transform:scale(1.08)}100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){#pop{animation:none}}
</style>
<defs>
<linearGradient id="gBody" gradientUnits="userSpaceOnUse" x1="210" y1="90" x2="210" y2="400">
<stop offset="0" stop-color="#7FE23A"/><stop offset=".5" stop-color="#58CC02"/><stop offset="1" stop-color="#43A002"/>
</linearGradient>
<linearGradient id="gLeaf" gradientUnits="userSpaceOnUse" x1="210" y1="0" x2="210" y2="60">
<stop offset="0" stop-color="#8FEB4F"/><stop offset="1" stop-color="#52BA05"/>
</linearGradient>
<linearGradient id="gLeaf2" gradientUnits="userSpaceOnUse" x1="210" y1="0" x2="210" y2="60">
<stop offset="0" stop-color="#A8F06E"/><stop offset="1" stop-color="#63CC12"/>
</linearGradient>
<clipPath id="mouthClip"><path d="M194 236 a16 16 0 0 0 32 0 z"/></clipPath>
</defs>
<g id="pop">
<ellipse cx="210" cy="404" rx="88" ry="12" fill="#B9E58F" opacity=".55">
<animate attributeName="rx" values="88;80;88" dur="3s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>
</ellipse>
<g>
<animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0" dur="3s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>
<g>
<animateTransform attributeName="transform" type="rotate" values="0 210 106;3.5 210 106;0 210 106;-3.5 210 106;0 210 106" dur="4.2s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1"/>
<rect x="204" y="30" width="12" height="78" rx="6" fill="#4FA802"/>
<circle cx="210" cy="30" r="7" fill="#4FA802"/>
<path d="M206 56 Q160 42 140 6 Q190 4 213 42 Z" fill="url(#gLeaf)"/>
<path d="M203 50 Q175 34 158 14" fill="none" stroke="#3F9702" stroke-width="2" opacity=".55" stroke-linecap="round"/>
<path d="M214 56 Q260 42 280 6 Q230 4 207 42 Z" fill="url(#gLeaf2)"/>
<path d="M217 50 Q245 34 262 14" fill="none" stroke="#57B70A" stroke-width="2" opacity=".6" stroke-linecap="round"/>
</g>
<rect x="175" y="348" width="28" height="44" rx="14" fill="url(#gBody)"/>
<rect x="217" y="348" width="28" height="44" rx="14" fill="url(#gBody)"/>
<rect x="154" y="376" width="54" height="22" rx="11" fill="#3F9702"/>
<rect x="212" y="376" width="54" height="22" rx="11" fill="#3F9702"/>
<path d="M168 258 C156 292 143 316 146 340 C150 364 176 372 210 372 C244 372 270 364 274 340 C277 316 264 292 252 258 C238 268 182 268 168 258 Z" fill="url(#gBody)"/>
<g stroke="#3E9200" opacity=".45" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(2,3)">
<path d="M182 348 L203 326 L213 335 L235 308" stroke-width="10"/>
<path d="M226 306 L243 301 L240 318 Z" stroke-width="6" fill="#3E9200"/>
</g>
<g stroke="#FFFFFF" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="M182 348 L203 326 L213 335 L235 308" stroke-width="10"/>
<path d="M226 306 L243 301 L240 318 Z" stroke-width="6" fill="#FFFFFF"/>
</g>
<ellipse cx="210" cy="286" rx="50" ry="10" fill="#3F9702" opacity=".25"/>
<circle cx="210" cy="190" r="92" fill="url(#gBody)"/>
<circle cx="144" cy="116" r="12" fill="url(#gBody)"/>
<circle cx="186" cy="94" r="10" fill="url(#gBody)"/>
<circle cx="254" cy="100" r="13" fill="url(#gBody)"/>
<circle cx="296" cy="152" r="12" fill="url(#gBody)"/>
<circle cx="120" cy="176" r="11" fill="url(#gBody)"/>
<circle cx="126" cy="240" r="10" fill="url(#gBody)"/>
<circle cx="294" cy="236" r="11" fill="url(#gBody)"/>
<ellipse cx="250" cy="126" rx="28" ry="11" fill="#FFFFFF" opacity=".2" transform="rotate(-20 250 126)"/>
<ellipse cx="210" cy="202" rx="66" ry="76" fill="#FFF9EC"/>
<circle cx="162" cy="228" r="8" fill="#FFC9BC" opacity=".75"/>
<circle cx="258" cy="228" r="8" fill="#FFC9BC" opacity=".75"/>
<path d="M170 174 Q182 167 194 173" fill="none" stroke="#4A3B2C" stroke-width="4" stroke-linecap="round"/>
<path d="M226 173 Q238 167 250 174" fill="none" stroke="#4A3B2C" stroke-width="4" stroke-linecap="round"/>
<ellipse cx="184" cy="202" rx="15" ry="15" fill="#2F2A26">
<animate attributeName="ry" values="15;15;2;15;15" keyTimes="0;.88;.92;.96;1" dur="3.8s" repeatCount="indefinite"/>
</ellipse>
<ellipse cx="236" cy="202" rx="15" ry="15" fill="#2F2A26">
<animate attributeName="ry" values="15;15;2;15;15" keyTimes="0;.88;.92;.96;1" dur="3.8s" repeatCount="indefinite"/>
</ellipse>
<g fill="#FFFFFF">
<animate attributeName="opacity" values="1;1;0;1;1" keyTimes="0;.88;.92;.96;1" dur="3.8s" repeatCount="indefinite"/>
<circle cx="189.5" cy="195.5" r="5"/>
<circle cx="241.5" cy="195.5" r="5"/>
<circle cx="179" cy="208" r="2.2"/>
<circle cx="231" cy="208" r="2.2"/>
</g>
<path d="M194 236 a16 16 0 0 0 32 0 z" fill="#4A2B23" stroke="#4A2B23" stroke-width="5" stroke-linejoin="round"/>
<ellipse cx="210" cy="254" rx="13" ry="10" fill="#FF8B7E" clip-path="url(#mouthClip)"/>
<g transform="rotate(-16 160 290)">
<rect x="146" y="282" width="27" height="64" rx="13.5" fill="url(#gBody)" stroke="#3F9702" stroke-width="2" stroke-opacity=".4"/>
<circle cx="159.5" cy="348" r="14" fill="url(#gBody)" stroke="#3F9702" stroke-width="2" stroke-opacity=".4"/>
<circle cx="149" cy="340" r="6" fill="#74DB2C"/>
</g>
<g transform="rotate(42 260 288)">
<animateTransform attributeName="transform" type="rotate" additive="sum" values="0 260 288;-16 260 288;16 260 288;-16 260 288;0 260 288" keyTimes="0;.25;.5;.75;1" dur="1.5s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1"/>
<rect x="247" y="204" width="27" height="90" rx="13.5" fill="url(#gBody)" stroke="#3F9702" stroke-width="2" stroke-opacity=".4"/>
<circle cx="260.5" cy="196" r="17" fill="url(#gBody)" stroke="#3F9702" stroke-width="2" stroke-opacity=".4"/>
<circle cx="247" cy="183" r="5.5" fill="#74DB2C"/>
<circle cx="260.5" cy="177" r="6" fill="#74DB2C"/>
<circle cx="274" cy="183" r="5.5" fill="#74DB2C"/>
<circle cx="242" cy="196" r="5" fill="#74DB2C"/>
</g>
</g>
</g>
</svg>`;

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;padding:0;height:100%;background:transparent;overflow:hidden}
  .stage{width:100%;height:100%;animation:riseUp .7s cubic-bezier(.34,1.6,.64,1) both}
  @keyframes riseUp{from{transform:translateY(70px);opacity:0}to{transform:translateY(0);opacity:1}}
  svg{width:100%;height:100%;display:block}
</style>
</head>
<body><div class="stage">${SVG}</div></body>
</html>`;

const RATIO = 430 / 420; // preserve the asset's aspect

export function VirloWave() {
  const { width: W } = useWindowDimensions();
  if (W === 0) return null;
  const size = Math.min(W * 0.52, 200);

  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size * RATIO }]}>
      <WebView
        source={{ html: HTML }}
        style={styles.web}
        containerStyle={styles.web}
        originWhitelist={['*']}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        opaque={false}
        androidLayerType="hardware"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 6,
    bottom: -26, // feet + shadow clipped off the bottom edge (kept a little low)
  },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
