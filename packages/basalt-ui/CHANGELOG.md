## [1.0.2](https://github.com/jkrumm/basalt-ui/compare/v1.0.1...v1.0.2) (2026-07-17)


### Bug Fixes

* make the import boundary unclobberable and stop false drift on sync ([98aba84](https://github.com/jkrumm/basalt-ui/commit/98aba8497eb359cbc86e3bee289d21d3e2dbd099))

## [1.0.1](https://github.com/jkrumm/basalt-ui/compare/v1.0.0...v1.0.1) (2026-07-17)


### Bug Fixes

* collapse delivery to one package, one command, one version ([94de69c](https://github.com/jkrumm/basalt-ui/commit/94de69c80b4369265e72bf375839d145ec1cf954))
* drop argo-shaped CLI defaults ([cd911d2](https://github.com/jkrumm/basalt-ui/commit/cd911d2f2756b678d65c3b65da8f6fbacd4096c1))
* export the BP hue families and p pair-picker from the tokens entry ([a9b34c5](https://github.com/jkrumm/basalt-ui/commit/a9b34c51dbab3c960c389bda24b10a67dba254e2))
* let consumers own their CI and git hooks ([15232df](https://github.com/jkrumm/basalt-ui/commit/15232df84ee04e47d2b913ba6bd489542685b67a))
* make the managed CLAUDE block oxfmt-clean ([8300ea6](https://github.com/jkrumm/basalt-ui/commit/8300ea6e4b06ce6d3a24fcfae22e846299ece829))
* print help instead of running the command ([a7a866c](https://github.com/jkrumm/basalt-ui/commit/a7a866c9677b71c3b35983fe93262204464f879d))

# [1.0.0](https://github.com/jkrumm/basalt-ui/compare/v0.4.2...v1.0.0) (2026-07-16)


* feat!: narrow the public token surface to the VX indirection ([ae1fa4c](https://github.com/jkrumm/basalt-ui/commit/ae1fa4c76390f9e113ecbbdb71ae2c1692e8dafc))
* feat!: pivot basalt-ui to an opinionated Mantine + React framework ([5cc7a9e](https://github.com/jkrumm/basalt-ui/commit/5cc7a9eebdc4e96fba925bb0c450b2dac71d2a82))


### Bug Fixes

* address review findings in the package (CLI + charts + provider) ([41e7380](https://github.com/jkrumm/basalt-ui/commit/41e73808cd032bc7164e23dfdeb125d78c1db835))
* align chart refLine to solid-by-default and dedupe chart internals ([f086216](https://github.com/jkrumm/basalt-ui/commit/f0862164d95115de465ccccf8df6e6b0c092dad8))
* align font weights, chart tooltips, and shell depth with the doctrine ([840e429](https://github.com/jkrumm/basalt-ui/commit/840e4296cd189dade8fe1e33b55cd8fca78dda13))
* apply NavLink active weight via classNames, not a nested styles selector ([c0ad87b](https://github.com/jkrumm/basalt-ui/commit/c0ad87bcac973754bdf79dd2348989675aedda05))
* cache persisted-state snapshot for useSyncExternalStore stability ([1b19179](https://github.com/jkrumm/basalt-ui/commit/1b19179bec595c5d21d17713f8161e31025567f9))
* close the 1.0 audit findings on the shipped preset, peers, and agent docs ([f8c0e47](https://github.com/jkrumm/basalt-ui/commit/f8c0e47a2f5436879b016a45e13584ddbb5b8b1b))
* correct basalt plugin skills paths and align skill docs with the real CLI ([36a92e5](https://github.com/jkrumm/basalt-ui/commit/36a92e580295ae7dc1555b67333d56e12a8997a1))
* correct the commands keybinding docs and the HotkeyBinding callback type ([8e4c9c5](https://github.com/jkrumm/basalt-ui/commit/8e4c9c5d77bf4f4b32d20c54d22fc854cb0f0cad))
* defer commands shortcut platform detection past render ([90302ba](https://github.com/jkrumm/basalt-ui/commit/90302ba7e15e589a9a483af64a4ffbf633618180))
* define process.env.NODE_ENV in vite preset for source-served basalt-ui ([47574dc](https://github.com/jkrumm/basalt-ui/commit/47574dc3eb4ecef2042904e173ecfb10e8be88f7))
* emit the agent Mantine-free ban and unify SURFACES projections ([5bc3bc3](https://github.com/jkrumm/basalt-ui/commit/5bc3bc308281d80ad57c21dce63a52a5d4e55139))
* fail loud on empty guard roots, align oxfmt scaffold, doctor version warn ([657a9d1](https://github.com/jkrumm/basalt-ui/commit/657a9d1e547a3c23909e17a3814958278a12af86))
* find deepest active nav item for breadcrumb parent chain ([361bf37](https://github.com/jkrumm/basalt-ui/commit/361bf372bf5a2a36938a37dc45f135e8c71c8ad1))
* give GuideLink a help glyph that reads at 14px ([5300366](https://github.com/jkrumm/basalt-ui/commit/530036601f5531052857396fe5751a68357270dd))
* guard useOnlineStatus for SSR and dedupe the notification listener ([cfcb2fd](https://github.com/jkrumm/basalt-ui/commit/cfcb2fd5ea4e3f15deed79dc071d85dedf827d56))
* harden aria-label tag scan, add rawRadius toggle ([7c3c1cd](https://github.com/jkrumm/basalt-ui/commit/7c3c1cd770916c39f7cc6d0ad53ad3abf1af3648))
* harden the agent stop-race and merge streaming-markdown overrides ([a85c101](https://github.com/jkrumm/basalt-ui/commit/a85c101b15c17a66970a25153fb7441ff0c04f5c))
* harden the agent stream hook and lazy peer fallbacks ([e322ff1](https://github.com/jkrumm/basalt-ui/commit/e322ff1f142661a1f2a497df3715b1be18dd4556))
* hold the TOC rail on a clicked section until its scroll settles ([bcdb4c0](https://github.com/jkrumm/basalt-ui/commit/bcdb4c03eb2ef7ad5bc0bde85d34393b6f34328d))
* keep light variant AA-legible in both schemes ([d50dbd6](https://github.com/jkrumm/basalt-ui/commit/d50dbd6b4e80ab61754e5de95866d013f0a752e6)), closes [hi#contrast](https://github.com/hi/issues/contrast)
* land the shadow-card ring on the box that carries the surface radius ([79bee79](https://github.com/jkrumm/basalt-ui/commit/79bee799e0f65c9cfd127cbfb6091cf1b014300b))
* make check-coverage portable and complete the plugin-install hint ([b328c21](https://github.com/jkrumm/basalt-ui/commit/b328c216ee32d6010e64fdf4aae89a1d5bd43983))
* make the 16px iOS input floor strict ([827fb68](https://github.com/jkrumm/basalt-ui/commit/827fb681c972e7a7e66443133901ec8f686d3648))
* make the consumer golden path survive a live onboarding run ([0769168](https://github.com/jkrumm/basalt-ui/commit/0769168798e90dfa9866b5d1818efbd891de9454))
* make the prose edge-margin resets actually apply ([df758cb](https://github.com/jkrumm/basalt-ui/commit/df758cbfd3fbc60928eec808fba9f3e1bb2c6b96))
* pad auto lower bound downward, widen Donut keys, export missing tokens ([4abeb2e](https://github.com/jkrumm/basalt-ui/commit/4abeb2e8f10b8c5ca6e6af52a3a953813bfc7a40))
* pin the ArticleCard meta line to the card floor ([cda2dc4](https://github.com/jkrumm/basalt-ui/commit/cda2dc41d6f87a39e9573df726fec3a1a93d5133))
* resolve TOC scroll-spy at the article's top and bottom ([4d05c22](https://github.com/jkrumm/basalt-ui/commit/4d05c22225ba0f1d7810c7c27a25ea8d5b53f898))
* revert barOpacity over-correction caught by re-review ([6bc148c](https://github.com/jkrumm/basalt-ui/commit/6bc148c5ad1fc95b72293e37bc5e031e6d5709c1))
* run check-theme in the consumer lefthook template ([e80ecb2](https://github.com/jkrumm/basalt-ui/commit/e80ecb266fb87b8958be7884400857eebbc85724))
* space content block objects on one prose rhythm ([9c13a0b](https://github.com/jkrumm/basalt-ui/commit/9c13a0ba144d569822b828cd57ffb2d97c7c6ec0))
* unblock browser and local-source dev rendering ([e17b060](https://github.com/jkrumm/basalt-ui/commit/e17b060086ea2b8f444d2dcc4ec84d8ecb0d3605))
* unify the scrollbar treatment and clear the sidebar bar of the rows ([4f6bf20](https://github.com/jkrumm/basalt-ui/commit/4f6bf20bc54b6103b1ff2e2ee39dc23b446c5a9c))
* use when_to_use frontmatter key in basalt skills ([8d025d1](https://github.com/jkrumm/basalt-ui/commit/8d025d17b1f912f7eb5bb70c0b2f40b6afe0df08))


### Features

* add AGENTS.md and the llms.txt package export ([489277f](https://github.com/jkrumm/basalt-ui/commit/489277f1a2f0fd2261bc25f226fca0d581559c4f))
* add aggregated connectivity monitoring system ([cc5906c](https://github.com/jkrumm/basalt-ui/commit/cc5906cd6036988c81a4ade1af976f0b5596687b))
* add an optional fallback to BasaltErrorBoundary ([b2448fc](https://github.com/jkrumm/basalt-ui/commit/b2448fcefe5bf16d8a13e65c64ad6b5212d430db))
* add article model, classification, and search to ./content ([e9c83e6](https://github.com/jkrumm/basalt-ui/commit/e9c83e6eaf5467c56141a44266952799026d1ed2))
* add basalt info, llms.txt, and full subpath resolution gate ([ad15f89](https://github.com/jkrumm/basalt-ui/commit/ad15f89c06c86ae3a4f1b7043006e31438ba6d9c))
* add card-with-border, raw-form-control and sub-16-input-font guard kinds ([8f5ed95](https://github.com/jkrumm/basalt-ui/commit/8f5ed953f0df2c57d4e614b34aa59add3320a3d6))
* add connectivity simulator page and indicator header ([91ec85c](https://github.com/jkrumm/basalt-ui/commit/91ec85c707a3808e6fb62341ff88b00a24c4b89f))
* add createSearchParamStore for URL-to-localStorage persistence ([2381dcc](https://github.com/jkrumm/basalt-ui/commit/2381dcc201f770d529971cb405f492a039ce204a))
* add dashboard date-range filter with persisted search params ([e7b17c0](https://github.com/jkrumm/basalt-ui/commit/e7b17c06d0c7272e48bb5eeef6d22ff319ab6343))
* add dashboard sub-routes with sidebar sub-navigation example ([4aadc19](https://github.com/jkrumm/basalt-ui/commit/4aadc19b842a425ec2ea3c31cd6cc36cb3f31b5a))
* add provider-agnostic account footer to the shell ([b0ed990](https://github.com/jkrumm/basalt-ui/commit/b0ed9905bb89e1e597548c3f88101fa5a8b458e6))
* add SidebarSearch, route-to-spotlight projector, scrollbar fix ([a1d5510](https://github.com/jkrumm/basalt-ui/commit/a1d5510b7b2a85e97e8e1dc407f2f146615ac2df))
* add sub-navigation popover on hover with inline children expansion ([92a7a19](https://github.com/jkrumm/basalt-ui/commit/92a7a19e3a9e2a18832fa5c032b3829cdcdcc254))
* add the agent streaming adapter subpath ([bb49fa7](https://github.com/jkrumm/basalt-ui/commit/bb49fa7bbfe9acc8732330b896d1e6f3e7564a65))
* add the basalt Claude Code plugin, marketplace, and design doctrine ([67528a8](https://github.com/jkrumm/basalt-ui/commit/67528a802f10485099f5abe1cc42de0ad75df061))
* add the basalt doctor command and query/router scaffold seeds ([0c12351](https://github.com/jkrumm/basalt-ui/commit/0c12351a24af51107e6af469b25e1f52137abf79))
* add the basalt oxlint plugin with three design-guard rules ([49c49e9](https://github.com/jkrumm/basalt-ui/commit/49c49e99a97b5fe3dddc3d6736a7d31e5d3c0f5e))
* add the commands adapter subpath ([b110df6](https://github.com/jkrumm/basalt-ui/commit/b110df691784bf6dd9038f99a4bd525eccf0cbba))
* add the content surface ([415cb83](https://github.com/jkrumm/basalt-ui/commit/415cb83cb12b65bc3aaa177621fcb95173389ba2))
* add the data adapter subpath (table + virtual list) ([95c74d1](https://github.com/jkrumm/basalt-ui/commit/95c74d129a67560f8d1703eeab5148b12e1d28aa))
* add the forms adapter subpath ([4940285](https://github.com/jkrumm/basalt-ui/commit/4940285821b33cefea21f69313760493e445e5ce))
* add the guard-hook PreToolUse adapter and wire GUARD_RULES ([cd1a368](https://github.com/jkrumm/basalt-ui/commit/cd1a368c328bfdd43c70b7121bdff6c9705a875f))
* add the notifications adapter subpath ([a71111c](https://github.com/jkrumm/basalt-ui/commit/a71111c135bcba1001b409158b91e67e594d0274))
* add the Phase-1 spine (SURFACES enforcement + BasaltRegister seam) ([08a3204](https://github.com/jkrumm/basalt-ui/commit/08a3204c1dde8a40371fe519d05cda749ce60cf3))
* add the query adapter subpath (client, unwrap, devtools) ([e2eb768](https://github.com/jkrumm/basalt-ui/commit/e2eb7689d7ab289e635a28ec5c411c286033a830))
* add the raw-scroll-container design-guard rule ([99504ff](https://github.com/jkrumm/basalt-ui/commit/99504ffbe69b959872db8f5abb4fe883fa2e8aa1))
* add the router-tanstack adapter subpath ([58a34b8](https://github.com/jkrumm/basalt-ui/commit/58a34b87d147cd945d110d6fdc0d50a2d8d2ed1e))
* add ThemeToggle with system color scheme support ([077c0d8](https://github.com/jkrumm/basalt-ui/commit/077c0d89b785fa49c6e7a045ef95f3d28d368501))
* add threaded multi-chat agent workspace ([1561ac7](https://github.com/jkrumm/basalt-ui/commit/1561ac73bf1d1d091d845dcd7ed9346522d37303))
* add useOnlineStatus, print styles, and a responsive chart wrapper ([af45dbe](https://github.com/jkrumm/basalt-ui/commit/af45dbe44fea08daaa0e6db5daaa4577c10d6cb5))
* add user-state simulator to the playground ([b920ae5](https://github.com/jkrumm/basalt-ui/commit/b920ae53cd2fa23d8c2342fb0a87a92acce6505d))
* bind command shortcuts to live keys and add a Spotlight store ([2947287](https://github.com/jkrumm/basalt-ui/commit/29472873b3f7e5d11ba0af5f405857372bd9b765))
* complete the basaltViteConfig vite preset ([ce75f99](https://github.com/jkrumm/basalt-ui/commit/ce75f99b4fd08a41571a0ecdfaa17687a59d67e4))
* controlled collapse, drawer close-on-nav, and nav-link class seams ([1bf4af2](https://github.com/jkrumm/basalt-ui/commit/1bf4af2547cb44bce282b5874be8ff05403c7745))
* copy a section link from a heading, on one copy idiom ([c806870](https://github.com/jkrumm/basalt-ui/commit/c806870f362b394832c5eb04bb262b65ba80207f))
* demo actionable notification center in playground ([5773cf1](https://github.com/jkrumm/basalt-ui/commit/5773cf18e51beb27dc9b4bd1a06f63dc0823db15))
* demo the content surface in the playground ([6df2a84](https://github.com/jkrumm/basalt-ui/commit/6df2a84b50cc6a1798f8fc7cb0963f2f324e3ff3))
* enforce motion discipline via oxlint + check-theme ([a1d66eb](https://github.com/jkrumm/basalt-ui/commit/a1d66eb70ccefe531ce8b7f6a0f8fa39c472c4b1))
* enforce the headless Mantine-free boundary and harden oxlint ([ff2942a](https://github.com/jkrumm/basalt-ui/commit/ff2942af8540ff104c782973c9435d753ebcf656))
* exercise new chart kinds and components page ([4c3c055](https://github.com/jkrumm/basalt-ui/commit/4c3c0557bf4ca5786375a268e0c98bbea5bdcfa8))
* extract --vx-* token system and visx chart suite from argo ([986f599](https://github.com/jkrumm/basalt-ui/commit/986f599d829e4c80f9f7e2fe4d8307c0e0160c62))
* extract Mantine theme, provider, and theme-lab from argo ([201c4d1](https://github.com/jkrumm/basalt-ui/commit/201c4d128b675c604128f8ca1e1744d40b567cb9))
* extract router-agnostic BasaltShell from argo ([fb5a86d](https://github.com/jkrumm/basalt-ui/commit/fb5a86d51ac09776579b2a10006ce71636c1954f))
* finish the M0 release gates and drop the unbacked dates peer ([6e02f57](https://github.com/jkrumm/basalt-ui/commit/6e02f57664767dc8e08d93bc1c39210e6f7244b0))
* float the sidebar nav scrollbar via Mantine ScrollArea ([94f02b1](https://github.com/jkrumm/basalt-ui/commit/94f02b114ba00324d5a95ab7c44f67ee647f4072))
* give the demo article's headings a copy-link anchor ([d61a3fc](https://github.com/jkrumm/basalt-ui/commit/d61a3fc63eadfda7c92f5b2ff9fb73a50f546994))
* integrate legend, tooltip, and crosshair into a config-driven chart system ([075c114](https://github.com/jkrumm/basalt-ui/commit/075c1149c75a56da7bd8ccf84d698060e87a64fb))
* land the DESIGN-SPEC overhaul across theme, shell, charts, agent ([00c3bf5](https://github.com/jkrumm/basalt-ui/commit/00c3bf545c8c49d02649cb5c262e8c4e9c24c58f))
* land Wave 1 maturation fixes across a11y, data split, and correctness ([7783adb](https://github.com/jkrumm/basalt-ui/commit/7783adbc31b1fd462f91fcdc6cc46c3a46a4bcb4))
* land Wave 2 maturation across a11y, API hygiene, and data lane ([4de05ad](https://github.com/jkrumm/basalt-ui/commit/4de05ad07b8851d0f94f27d0488dfb535d355945))
* make token factories const-generic and exact-keyed ([50299f6](https://github.com/jkrumm/basalt-ui/commit/50299f69eb15ec037f0ff0247f97c05e3cf16d7a))
* migrate playground to file-based TanStack Router ([d29966d](https://github.com/jkrumm/basalt-ui/commit/d29966da5729c5938e98ba3ac728063d874b517c))
* re-export query hooks and add data-table loading and sorting control ([089b8a6](https://github.com/jkrumm/basalt-ui/commit/089b8a6435db4590c946483b1e08d7ce07b22fbd))
* rebuild playground charts on the config-driven chart system ([bce5049](https://github.com/jkrumm/basalt-ui/commit/bce5049aae11016057afe1e03401ba9817f5af93)), closes [hi#cardinality](https://github.com/hi/issues/cardinality)
* refine sub-navigation with tree-line children and breadcrumb hierarchy ([69a2292](https://github.com/jkrumm/basalt-ui/commit/69a2292908de2c3557213d77d250c11b7c302c3e))
* refine the sidebar account footer's identity display ([ef38297](https://github.com/jkrumm/basalt-ui/commit/ef38297836d7b14e929e66cbd9e4df94cec96601))
* remove redundant dashboard overview child, fix breadcrumb title ([4cbf563](https://github.com/jkrumm/basalt-ui/commit/4cbf5637def6b401b2e2cbd04e3ac5d74d711e79))
* render agent demos through PartList and regroup the nav spine ([a26eced](https://github.com/jkrumm/basalt-ui/commit/a26eced0f3ad56b8d8ebac51993dac3d43900fca))
* render playground chat markdown via the content stack ([aa64af6](https://github.com/jkrumm/basalt-ui/commit/aa64af62ef7c3817e39dc262b5ba466c24ae9d5e))
* reskin dark chrome to zinc-charcoal palette ([0004a78](https://github.com/jkrumm/basalt-ui/commit/0004a78d738aaa01f8e35e63e8190fd6ccdfddfb))
* restyle playground and docs to the DESIGN-SPEC identity ([12b2a77](https://github.com/jkrumm/basalt-ui/commit/12b2a77cdadb981543c29b93a2dd4b4f77442288))
* restyle sidebar to framed dense grouped nav ([07d1d2f](https://github.com/jkrumm/basalt-ui/commit/07d1d2fd932baa68bd707cc364924b5b51c00d2e))
* rework notification center into actionable inbox ([71b95a1](https://github.com/jkrumm/basalt-ui/commit/71b95a1f831d429482fd9ab3160bf56b9cf1e44b))
* round out query, notifications, and state ergonomics ([dab3186](https://github.com/jkrumm/basalt-ui/commit/dab3186b72f9c09b027374fc835ea623f90233e7))
* set quotations in italic ([0632731](https://github.com/jkrumm/basalt-ui/commit/063273160c88b8429716953cb3c7bdc011790bda))
* ship the agentic layer — basalt-* rules and the init/sync CLI ([3612cc4](https://github.com/jkrumm/basalt-ui/commit/3612cc4a1a80759251da6ee8bb7cf789cdae88cc))
* showcase thread workspace in playground ([8e25658](https://github.com/jkrumm/basalt-ui/commit/8e2565808645f0ac3916f8481b8d380f1923fe6c))
* tighten design density and unify the card idiom ([cb04e7c](https://github.com/jkrumm/basalt-ui/commit/cb04e7c9bdb10fb3d4c878fbbdb9ff6fc7cde6d5))
* unify markdown rendering on the ./content stack ([040b9be](https://github.com/jkrumm/basalt-ui/commit/040b9beddc1d3b20eac261a85a41f906608f3cba))
* warm-neutral theme, chart kinds, dense shell ([80476c2](https://github.com/jkrumm/basalt-ui/commit/80476c26e33b7994b699b62055ebc475f0c4eb75))
* wire article filtering into the playground content overview ([30f5fa8](https://github.com/jkrumm/basalt-ui/commit/30f5fa8c7f8d5116d0f2aed230fc8daeaf3cfc6b))
* wire breadcrumb parent link to client-side router navigation ([95f2e65](https://github.com/jkrumm/basalt-ui/commit/95f2e653f307ead1c482e5096674be66c4c24b4d))
* wire routes and settings into the command palette ([52204f2](https://github.com/jkrumm/basalt-ui/commit/52204f2e283956980875d0948e0429e4fcbb6c93))
* wire ThemeToggle into playground shell and settings ([048b447](https://github.com/jkrumm/basalt-ui/commit/048b447139844229d679bae0d4b38da524b2d166))


### BREAKING CHANGES

* the raw palette pairs and helpers (ACCENT, BP, FILL, INK,
NEUTRAL, p, SEMANTIC, SHADOW, STATUS, SURFACE) are no longer exported from
basalt-ui/tokens or basalt-ui/charts.
* None — useOnlineStatus still works; new hook is additive.
* drops the ./css and ./starlight Tailwind exports. The package is
now a Mantine framework requiring React 19 and @mantine/core + @mantine/hooks as
peer dependencies.

# basalt-ui 1.0 — the Mantine pivot

> The 1.0.0 entry above this block is the generated commit record; this is the story.

basalt-ui 1.0 is a ground-up rebuild. The 0.x line was a Tailwind CSS design system; 1.0 replaces
it with an opinionated framework for **Mantine v9 + React 19** apps, extracted from a production
dashboard. Same npm name, clean break: the `./css` and `./starlight` exports are gone, and nothing
from 0.x carries over.

### What you get

- **One provider, one shell.** `BasaltProvider` wires the theme, palette injection, error
  boundary, connectivity, and overlays; `BasaltShell` is a router-agnostic app frame with sidebar,
  mobile nav, breadcrumbs, page header, and an account slot.
- **Charts without Mantine.** A visx chart system (`ZonedLine`, `Bars`, `StackedArea`, `Donut`,
  `MultiLine`, `DualPanel`, `Heatmap`, sparklines) behind the three-tier `--vx-*` token system —
  the `./charts` and `./tokens` subpaths are Mantine-free by machine-enforced boundary.
- **Seven batteries** as opt-in subpaths with their own optional peers: `./query`,
  `./router-tanstack`, `./forms`, `./notifications`, `./commands`, `./data`, `./agent` — plus the
  `./content` prose/docs surface (markdown, code blocks, TOC, article layouts) and a headless
  AI-chat runtime with multi-thread support and a shipped `ThreadWorkspace`.
- **Doctrine as code.** `basalt check-theme`, a shipped oxlint preset with custom design-guard AST
  rules, and a `basalt guard-hook` PreToolUse adapter all share one guard registry — the design
  system says no _before_ review does.
- **Built for coding agents.** `basalt init` scaffolds twelve path-scoped rules, a managed CLAUDE.md
  block, and a `DESIGN.md` seed; the package ships `llms.txt`, `AGENTS.md`, and `basalt info --json`
  so an agent resolves real imports instead of guessing; `basalt sync --check` keeps it all fresh
  in CI.

### Breaking

Everything, deliberately: 0.4.2 had no external consumers. Treat 1.0 as a new library — start from
the README quick-start (`BasaltProvider` + `createBasaltTheme` + the `styles.layer.css` import
order) and let `basalt init` lay down the doctrine.

## [0.4.2](https://github.com/jkrumm/basalt-ui/compare/v0.4.1...v0.4.2) (2026-03-12)

### Bug Fixes

- add sideEffects and provenance to package.json ([3a1e512](https://github.com/jkrumm/basalt-ui/commit/3a1e51219fb500bebe17eb8a9031ec77296fc1d6))

## [0.4.1](https://github.com/jkrumm/basalt-ui/compare/v0.4.0...v0.4.1) (2026-03-12)

### Bug Fixes

- pass NODE_AUTH_TOKEN to npm publish step ([5b3ba0b](https://github.com/jkrumm/basalt-ui/commit/5b3ba0b5f933775a6864af58d2d333bac969d6b8))

# [0.4.0](https://github.com/jkrumm/basalt-ui/compare/v0.3.0...v0.4.0) (2026-03-12)

### Bug Fixes

- add UTM param to docs link in index.css comment ([4945e38](https://github.com/jkrumm/basalt-ui/commit/4945e38cbd28d16dd504ae0b1740fe2f688a268a))
- handle workflow_dispatch ref in publish version check ([5c72b9d](https://github.com/jkrumm/basalt-ui/commit/5c72b9dbbff1c5999b06e8c9dc7b413b70da1702))
- upgrade CI to Node 24, fix CodeRabbit doc issues ([ea97378](https://github.com/jkrumm/basalt-ui/commit/ea97378ac1c061277738f4f2e8849f5f3834341a))

### Features

- add fontsource deps to example-react, rewrite font docs ([067cd76](https://github.com/jkrumm/basalt-ui/commit/067cd76582802d3608b9f9160483e190cb5c45a1))
- fix font preloads on Starlight docs pages ([fb694c3](https://github.com/jkrumm/basalt-ui/commit/fb694c345fdcc165104ff6e4c1fa10cca577e811))
- integrate npm publish into release workflow ([d6e5003](https://github.com/jkrumm/basalt-ui/commit/d6e500326731a954effb97802f7cc6ba87a3085b))
- remove [@font-face](https://github.com/font-face) declarations, delegate font loading to apps ([ea083b4](https://github.com/jkrumm/basalt-ui/commit/ea083b4e12b41d2249a46437167f38ddc697b8f9))
- upgrade to Astro 6 and adopt stable Fonts API ([ee17c45](https://github.com/jkrumm/basalt-ui/commit/ee17c457f9ba48bdcb30b6f55308d433771878b3))

# [0.3.0](https://github.com/jkrumm/basalt-ui/compare/v0.2.2...v0.3.0) (2026-02-28)

### Bug Fixes

- remove --frozen-lockfile from Docker bun install ([b8ee288](https://github.com/jkrumm/basalt-ui/commit/b8ee288d10f04089f7d364caa9575c2c3574dae4))
- remove scope from release commit message to satisfy commitlint ([5c8ca17](https://github.com/jkrumm/basalt-ui/commit/5c8ca17ced4b646ee7b51d7fc263a12e989add60))
- replace @semantic-release/npm with exec to bypass workspace: protocol error ([905dc95](https://github.com/jkrumm/basalt-ui/commit/905dc95de06a1bf9f59ebf3fe9c1e4bfec5c3f6c))
- skip Docker job on release dry run ([f479092](https://github.com/jkrumm/basalt-ui/commit/f479092ff7fa30d442f6d55a2454b7a94a4ad2ac))

### Features

- add OCI labels to Docker images ([cd8fcfb](https://github.com/jkrumm/basalt-ui/commit/cd8fcfb46e079a023065d09fa4b7f8d100a33086))

# Changelog

## [0.2.2](https://github.com/jkrumm/basalt-ui/compare/v0.2.1...v0.2.2) (2026-02-27)

### Performance Improvements

- change font-display from block to swap ([ed485ba](https://github.com/jkrumm/basalt-ui/commit/ed485ba0bdddad77ed6f3e773dc0c565f4a7523d))

## [0.2.1](https://github.com/jkrumm/basalt-ui/compare/v0.2.0...v0.2.1) (2026-02-09)

### Bug Fixes

- add missing language subsets and font weights ([e667d9a](https://github.com/jkrumm/basalt-ui/commit/e667d9af7e63527d807f946e97ac556ad3792255))
- use font-display block to prevent flickering in Astro MPAs ([c3c286f](https://github.com/jkrumm/basalt-ui/commit/c3c286ffc41db5ebe3bdec0f45523c02baa3e7fa))

# [0.2.0](https://github.com/jkrumm/basalt-ui/compare/v0.1.0...v0.2.0) (2026-02-09)

### Features

- enhance package exports and peer dependencies ([d34a2cf](https://github.com/jkrumm/basalt-ui/commit/d34a2cf38f30d25ab759d6e7922a737f163104f8))
- integrate fonts and improve CSS architecture ([b95fc24](https://github.com/jkrumm/basalt-ui/commit/b95fc24d8c6bcc1357e77ba9cfbadae0348f33ab))
- **JK-34:** add `shadcn` and `tw-animate-css` to basalt-ui dependencies ([20c5a10](https://github.com/jkrumm/basalt-ui/commit/20c5a10f2c9d0fda9eed1e2be3d0d16fca6253ff))

# 0.1.0 (2025-12-12)

### Features

- add Starlight compatibility with dedicated CSS file c16087c
- add Tremor Raw compatibility with enhanced color system 9e74979
- added foundation palette architecture and foreground color pairings 2efa222
- added Tailwind Typography integration and Tremor styling 1ec6f05
- adopt Nord Aurora colors and Frost blue as primary accent 3b1f44d, closes #81a1c1 #81a1c1 #5e81ac
- **basalt-ui:** implement mature OKLCH-based volcanic design system 1ad67b1
- introduce Basalt UI a Tailwind CSS design system fe4db96
- **JK-32:** rewrite basalt-ui README and metadata d1b6b90
- refine OKLCH color tokens for improved contrast and consistency aedf443
- replace Tailwind preset with @tailwindcss/typography integration 120c80e

All notable changes to basalt-ui will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).
