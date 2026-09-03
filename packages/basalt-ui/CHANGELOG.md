## [1.29.1](https://github.com/jkrumm/basalt-ui/compare/v1.29.0...v1.29.1) (2026-09-03)


### Bug Fixes

* collapse unwrap's two overloads into one conditional generic ([80152d7](https://github.com/jkrumm/basalt-ui/commit/80152d7d8030ce3455d8ba4f314e6aa59a88feab))
* let BasaltDevDock's router prop accept a real TanStack Router ([955cdfc](https://github.com/jkrumm/basalt-ui/commit/955cdfca02d28e04e4665e652f1b0a53eb92cdfb))
* make chart-missing-aria-label's tag scan brace-depth aware ([0d6c122](https://github.com/jkrumm/basalt-ui/commit/0d6c12239e99dc26b15d202050810c7788317acf))
* retire basalt/query-dual-import — its premise is unreachable post-C1 ([372bc1f](https://github.com/jkrumm/basalt-ui/commit/372bc1fa9a32008a1cde2f13e0a2f826262cbe39))

# [1.29.0](https://github.com/jkrumm/basalt-ui/compare/v1.28.0...v1.29.0) (2026-09-02)


### Bug Fixes

* record every 1.29.0 removal, retire the dead notifications rule, tickValues ([21a6c28](https://github.com/jkrumm/basalt-ui/commit/21a6c287ad020e50dad7004135e1695bce58e2d6))


### Features

* a format module, chart states by flag, useBreakpoint, command handles ([dbf38f7](https://github.com/jkrumm/basalt-ui/commit/dbf38f79d01a2333181cf3f490f66ae8cd0dffbf))
* transport message ids, onError and hydrated resume in the agent layer ([a30959e](https://github.com/jkrumm/basalt-ui/commit/a30959ef81eac0f555e0ad06e6fe68366cb358a8))

# [1.28.0](https://github.com/jkrumm/basalt-ui/compare/v1.27.0...v1.28.0) (2026-09-02)


### Bug Fixes

* confirm settles on a throw, drafts flush on unmount, panel labels click ([fb4e9e7](https://github.com/jkrumm/basalt-ui/commit/fb4e9e7c865d364d6946d8d1cf65e7df19d2d22b))
* forward every WidgetHeader prop a Section accepts ([39dd9af](https://github.com/jkrumm/basalt-ui/commit/39dd9afcffe08ef01ce7a69e5868cb2cca92eb01))
* give PageBar row 2 a declared two-line phone form ([be8dbef](https://github.com/jkrumm/basalt-ui/commit/be8dbef7cea3d26bfeb1178685bba8bd56fd5747))
* give the two CBBI distribution charts distinct chart ids ([0e76faf](https://github.com/jkrumm/basalt-ui/commit/0e76fafb984cae9a14af90cfa05f9899683a8eeb))
* import the cbbi query types through basalt-ui/query ([ccf5738](https://github.com/jkrumm/basalt-ui/commit/ccf57386e31d6e26009e25c7501fad6cf0c2107f))
* keep the mobile nav bar at its 48px touch floor under the seam ([6daa174](https://github.com/jkrumm/basalt-ui/commit/6daa1741a8d460e38dbdae80f4a9f96797ea9866))
* keep the sticky table header at the scroller's top edge ([2ef7472](https://github.com/jkrumm/basalt-ui/commit/2ef7472f48f45eef0d730d25e7285a5443ad5352))
* mount the aside panel's children once on the phone path ([badb691](https://github.com/jkrumm/basalt-ui/commit/badb6914d6dcd0830b2612d4384efeaab36c37a2))
* raw-size-literal was inert in its own test fixture ([e547eee](https://github.com/jkrumm/basalt-ui/commit/e547eee7eb8805badd47ba577006a800ec278838))
* widget header actions wrap at phone width, notification center fills ([a90fe7e](https://github.com/jkrumm/basalt-ui/commit/a90fe7e4a214c18fc452c7e1bc5e81d344c047bf))


### Features

* a data table contains itself horizontally ([3147d3b](https://github.com/jkrumm/basalt-ui/commit/3147d3be8cebddce6e758d92ceea741982f8d1e9))
* a form layer on top of the @mantine/form adapter ([99d56b7](https://github.com/jkrumm/basalt-ui/commit/99d56b7020a3285a5f76ae0ed6877c33de04567d))
* a phone tier, step curves, a format law and states in the chart layer ([d506292](https://github.com/jkrumm/basalt-ui/commit/d506292c29c190810125c33efdd0978977033118))
* a real log axis on CartesianChart with 1-2-5 ticks ([eb6fd91](https://github.com/jkrumm/basalt-ui/commit/eb6fd91f60e26b983755aa20294a87a7affa7b5b))
* a widget grid, a stat group, a query-aware stat card and header slices ([ea7d712](https://github.com/jkrumm/basalt-ui/commit/ea7d7120231dcfb67f52b108a88c32ad6ede6c11))
* accent-tinted active nav rows so hover cannot impersonate them ([25021d9](https://github.com/jkrumm/basalt-ui/commit/25021d9517f4ea017bd33a3de39d24a41caafdba))
* add the CBBI live-data evidence page to the playground ([b8fe541](https://github.com/jkrumm/basalt-ui/commit/b8fe541a6efb644f11f4f4b729801ccb3f103062))
* add the PageAside shell region ([feb8c3a](https://github.com/jkrumm/basalt-ui/commit/feb8c3a575590bfd462be2c20c96e47acb7d4bf6))
* delta polarity on WidgetHeader and a group tier inside the aside ([2b2083d](https://github.com/jkrumm/basalt-ui/commit/2b2083dbc98695aeb48c09398fde01280d32ee8b))
* diagnose, preset and advise in the CBBI aside ([bc9e651](https://github.com/jkrumm/basalt-ui/commit/bc9e651f18491782e410bf8619ccabdfe1e9fd3a))
* drop test files from the tarball and add a package.json export ([022e0c0](https://github.com/jkrumm/basalt-ui/commit/022e0c04f9f45e4f3e48e85d9d28c80df297a07f))
* every component takes className and style; misuse throws a named error ([21a9a9a](https://github.com/jkrumm/basalt-ui/commit/21a9a9ad650d035a742438ae30ec1c2fc785f5bf))
* fit-checked choice tracks and panel rows in the phone sheet ([2ac8ef1](https://github.com/jkrumm/basalt-ui/commit/2ac8ef1c78391321c2fe432f5e002aaf64deaba5))
* form rows are control homes and a rule catches the missing field key ([b63b1b5](https://github.com/jkrumm/basalt-ui/commit/b63b1b5659d454aa1e8e9ef972affb4da097a925))
* guard bound controls outside a home and teach the agent the aside ([c4935ce](https://github.com/jkrumm/basalt-ui/commit/c4935ce82e9d7d53246230027c558543d809dccf))
* guard the wiring doctrines and give deprecations a lifecycle ([f8b4ce6](https://github.com/jkrumm/basalt-ui/commit/f8b4ce699c726c93929b10337ba05ff7b10c9a1e))
* header above the sidebar and main as the shell scrollport ([9a9499c](https://github.com/jkrumm/basalt-ui/commit/9a9499c062121456a3e9d2b7bae3946a8d7bb763))
* let SliderControl compose its readout and carry an end control ([b8f560b](https://github.com/jkrumm/basalt-ui/commit/b8f560b26310e0855f26df752a92d6ffb88aff5a))
* let the CBBI page fold price and confidence into one dual-axis chart ([3d6da25](https://github.com/jkrumm/basalt-ui/commit/3d6da2583c22b26e697b06bfcabc72b89b0068fb))
* measured rotated-label margins, heatmap thinning and a live legend rollup ([57153f7](https://github.com/jkrumm/basalt-ui/commit/57153f72d546655b2f83e54b1073f090169e1291))
* more-sheet rows share the sidebar's density and keep a gutter ([8ea3afd](https://github.com/jkrumm/basalt-ui/commit/8ea3afd8996da55574b9b88f40318d9a5e3d25e9))
* notification payloads narrow per kind ([3f33079](https://github.com/jkrumm/basalt-ui/commit/3f330795e84255546adf55fbcb90e8d406e4e425))
* null gaps, log guards and measured x ticks in the chart layer ([d771508](https://github.com/jkrumm/basalt-ui/commit/d77150803d437bce16819fc98fa247ac81589692))
* one connectivity prop, guarded wiring, non-blocking overlay mount ([f150f78](https://github.com/jkrumm/basalt-ui/commit/f150f78aca6100e53308e8fc4df05be0ecd1249f))
* one home per field on the CBBI page ([2beb94b](https://github.com/jkrumm/basalt-ui/commit/2beb94b80794ed9a78d980be060cfa70d3d5369a))
* overlays.confirm and notifyUndo ([94a4053](https://github.com/jkrumm/basalt-ui/commit/94a40533530eed72f025162c385e0aa87fc5a45d))
* paint every AppShell region seam in the divider token ([f794f89](https://github.com/jkrumm/basalt-ui/commit/f794f89a27ffb0ddf35b4337b9fe9ab8c200b486))
* playground demos follow the shell scrollport and fit-checked tracks ([c43d08d](https://github.com/jkrumm/basalt-ui/commit/c43d08d0edfd752a04a010dcfe4be286f2a2b3ff))
* playground demos for the wave 3 surface and consumer-vantage type guards ([e777770](https://github.com/jkrumm/basalt-ui/commit/e77777016d470a4456a380e4c6d6f97799fe32d9))
* playground follows the inputProps rename and the overlay mount change ([a7417e5](https://github.com/jkrumm/basalt-ui/commit/a7417e56b3ef7b8e14ae59231f49ded3192e3764))
* query-aware containers, row activation, selection and typed actions ([4ad19a5](https://github.com/jkrumm/basalt-ui/commit/4ad19a5c991df88ede925b266baaf8b6d1a9b0b0))
* rename the forms field helper to inputProps ([f82516f](https://github.com/jkrumm/basalt-ui/commit/f82516f29710f3839f2ed0e1b9f488521b20127c))
* render bound controls as panel rows inside PageAside ([6eee086](https://github.com/jkrumm/basalt-ui/commit/6eee0861f7b7027e0148fa572513f2eb4622c246))
* render no legend when a single series has no legend config ([48f7718](https://github.com/jkrumm/basalt-ui/commit/48f7718d467383044da87d2b519269c2bc9d794b))
* shared common primitives for props, refs, errors and validation ([850d52c](https://github.com/jkrumm/basalt-ui/commit/850d52c1d2dca2a1101ec723094e40ea66586ee6))
* split theme-lab boot helpers into an SSR-safe module ([a6a4b81](https://github.com/jkrumm/basalt-ui/commit/a6a4b81dd2c07dcf53dc70fe1459f9468e62c073))
* stat card header spans the card and starts at its top ([c64b6d1](https://github.com/jkrumm/basalt-ui/commit/c64b6d1eb34ce2bc105b0a72a768ad86afce99d3))
* stress routes in the playground for charts, data, states and primitives ([f7d8273](https://github.com/jkrumm/basalt-ui/commit/f7d82730e74f9ffef55cf6d38a6373c2bfecf631))
* typed facet ids, a VirtualList ref handle and a required getItemKey ([4f833a2](https://github.com/jkrumm/basalt-ui/commit/4f833a2d14f1713feff76a86b3bbd26283e417b6))

# [1.27.0](https://github.com/jkrumm/basalt-ui/compare/v1.26.0...v1.27.0) (2026-08-27)


### Features

* close the gaps the argo and linewatch migrations found ([79d9a6c](https://github.com/jkrumm/basalt-ui/commit/79d9a6ce69101309d8949f70a9bba2ed25dc513e))
* dogfood NumberFilter and StatCard unit/breakdown in the playground ([7a690be](https://github.com/jkrumm/basalt-ui/commit/7a690bea7998a9d2e9b71d304817476f45066b04))

# [1.26.0](https://github.com/jkrumm/basalt-ui/compare/v1.25.0...v1.26.0) (2026-08-27)


### Bug Fixes

* align shell comments and ChartCard rem fallbacks with the derived scale ([9d09e24](https://github.com/jkrumm/basalt-ui/commit/9d09e246dad161829ebb261af8816ef2f30d2388))


### Features

* add PageBar, Section, the controls subpath and WidgetHeader composers ([ccb24bf](https://github.com/jkrumm/basalt-ui/commit/ccb24bf85a0c76de603feb54992b76a71797249f))
* add sidebar blocks and the controls guards ([cd847fb](https://github.com/jkrumm/basalt-ui/commit/cd847fb2cf99a686ab0356fda8dcefc91f3eba09))
* add the ctl control tier, WidgetHeader and createSearchStore ([3b52ade](https://github.com/jkrumm/basalt-ui/commit/3b52ade43ddc3a62bfd6f4266dd201616d22b89e))
* cut the agent layer to six rules, close consumer gaps, polish the tier ([3e4c5b6](https://github.com/jkrumm/basalt-ui/commit/3e4c5b6fddd21a6acad956a702039bed92f0b4b9))
* dogfood sidebar blocks in the playground, settle the form-row home ([1920173](https://github.com/jkrumm/basalt-ui/commit/1920173f8c79f2a0d303df4704080bf15ab36f0b))
* migrate the playground to PageBar and controls, add the reference page ([aa24fe6](https://github.com/jkrumm/basalt-ui/commit/aa24fe6cbd5da857bd002d111be4144e28d01e78))
* wire card, chart and section controls into the reference page ([bb8c2be](https://github.com/jkrumm/basalt-ui/commit/bb8c2beecb7eb4a580b5f2f2da9aef711774a859))

# [1.25.0](https://github.com/jkrumm/basalt-ui/compare/v1.24.0...v1.25.0) (2026-08-22)


### Features

* make manualPagination refuse every prop that would misreport ([d18e5f1](https://github.com/jkrumm/basalt-ui/commit/d18e5f1d8091af82a589a140ece7484cca654084))

# [1.24.0](https://github.com/jkrumm/basalt-ui/compare/v1.23.1...v1.24.0) (2026-08-22)


### Bug Fixes

* stop check-theme fabricating a config, and re-gate the provenance line ([99a45c0](https://github.com/jkrumm/basalt-ui/commit/99a45c0dc284850b4140a6ff7719dbade4795f09))
* stop raw-hex reading HTML entities, and teach the guard the SFC dialect ([f1b0562](https://github.com/jkrumm/basalt-ui/commit/f1b0562efeb718921509253f9ee215bf461c3c01)), closes [#123](https://github.com/jkrumm/basalt-ui/issues/123) [#125](https://github.com/jkrumm/basalt-ui/issues/125)


### Features

* playground routes for QueryState and the table body chrome ([e150a00](https://github.com/jkrumm/basalt-ui/commit/e150a0051bf743137751a3d5c17f202c0984aaa7))
* ship the query loading/error branch and the table body chrome ([963bf04](https://github.com/jkrumm/basalt-ui/commit/963bf047cf9ac4fac3cecceecbd0c378ee37f79d))

## [1.23.1](https://github.com/jkrumm/basalt-ui/compare/v1.23.0...v1.23.1) (2026-08-22)


### Bug Fixes

* gate the two chart tag rules on where the tag came from ([0075224](https://github.com/jkrumm/basalt-ui/commit/007522416bf9a3269e5f45b7ae7f45203434bae7))
* make the CLI answer which version ran, and stop it failing open ([0edf50e](https://github.com/jkrumm/basalt-ui/commit/0edf50e1d6f61b349f989fd10fe384d4a91a9af1))
* stop a typo'd band state from asserting absence ([6c1515c](https://github.com/jkrumm/basalt-ui/commit/6c1515c3ecbf019d9971e5b247e81e5cce3ae316))

# [1.23.0](https://github.com/jkrumm/basalt-ui/compare/v1.22.0...v1.23.0) (2026-08-22)


### Bug Fixes

* make sync resolve, and report, what the other two commands already do ([fcc5d3b](https://github.com/jkrumm/basalt-ui/commit/fcc5d3b862e90db03be9ae3daddbde56da15e415))
* make the two annotation parsers agree, and pin the whole shape grid ([5a25825](https://github.com/jkrumm/basalt-ui/commit/5a25825342930236e35a4c8ecd1157fc6c3c8eda))
* stop a non-finite absent share painting a band that never renders ([e8fae5b](https://github.com/jkrumm/basalt-ui/commit/e8fae5b205a9f74b31289591f8948f50a3e647eb))
* teach chart-in-raw-surface the two new kinds ([fc34a3b](https://github.com/jkrumm/basalt-ui/commit/fc34a3bed4e05083288dcd22fc1e4b2cc81a1863))
* teach unframed-chart the two new kinds too ([cb4e5b7](https://github.com/jkrumm/basalt-ui/commit/cb4e5b7977ff8a141bc4ec78d3c18b515fc41fed))


### Features

* give CartesianChart the x tick-VALUES seam its band siblings already have ([d94137d](https://github.com/jkrumm/basalt-ui/commit/d94137d20d496e8da1e0e0869c01d2d4c1577560))
* let basaltAppPlugin's icons option name a real icon file ([c0b182e](https://github.com/jkrumm/basalt-ui/commit/c0b182e580c6289b5018be9d840a588e29dea5d3))
* playground routes for BandStrip and MirroredBars ([ba6172d](https://github.com/jkrumm/basalt-ui/commit/ba6172d9ad40cf7b1e3c183e2598e79b5326c2e7))
* two banded chart kinds — BandStrip and MirroredBars ([0e4f5f7](https://github.com/jkrumm/basalt-ui/commit/0e4f5f7107e71be92eb3b6bec6ebf5587d5c607b))

# [1.22.0](https://github.com/jkrumm/basalt-ui/compare/v1.21.0...v1.22.0) (2026-08-22)


### Bug Fixes

* let `icons: false` reach the manifest it was only skipping in the head ([58abe27](https://github.com/jkrumm/basalt-ui/commit/58abe27be10e5baf7c4659aa79904a7646ff092d))
* scope the shadow-export tripwire to basalt consumers, and to components ([60716d4](https://github.com/jkrumm/basalt-ui/commit/60716d4ba00908c1a157f5568e192c6c50e438ec))
* stop sync scaffolding a second consumer, and give the audit the oxlint half ([45cf3d3](https://github.com/jkrumm/basalt-ui/commit/45cf3d340f081e61f3f10f852d12f79928993d2a))


### Features

* give the waiver audit an annotation reader, and fix two shapes ([0dde850](https://github.com/jkrumm/basalt-ui/commit/0dde85052269780a61ead0688005db16e24f009a))

# [1.21.0](https://github.com/jkrumm/basalt-ui/compare/v1.20.0...v1.21.0) (2026-08-22)


### Bug Fixes

* delete a waiver that stopped covering anything ([3984281](https://github.com/jkrumm/basalt-ui/commit/3984281fff6313c225bdf1e185de4a427d2ef4df))
* emit 0.1, not 0.10, from the shadow palette itself ([48adfff](https://github.com/jkrumm/basalt-ui/commit/48adfffcc9ad7713cacc07c1fc090b219fd175fa))
* let the real color scheme win, and keep <meta charset> in its window ([8708c85](https://github.com/jkrumm/basalt-ui/commit/8708c85f1488b25e6a059ee879dcadf6350278a2))
* make an annotation start its comment, and let it scope to one node ([a4cf78c](https://github.com/jkrumm/basalt-ui/commit/a4cf78c546d291c33a27bf94d7636758072a1005))
* persist sidebar collapse through basalt's own state primitive ([c576040](https://github.com/jkrumm/basalt-ui/commit/c576040172dfeb8d66b52909bbcf55b7b1f91c70))
* resolve the paths the wiring checks only matched, and audit the waivers ([c595181](https://github.com/jkrumm/basalt-ui/commit/c5951817ed01d7729f031bba2f3da50c3bf60666))
* restore the palette fixture to emitter bytes ([605e240](https://github.com/jkrumm/basalt-ui/commit/605e240387a417f57ae8070f97bad79d97545d60))


### Features

* give the type ladder the two rungs consumers could only waive ([29b9ef3](https://github.com/jkrumm/basalt-ui/commit/29b9ef3767282dffb51fb52138d6ae4f1d24dd62))
* make the search-param store's reader reachable from the API ([6924970](https://github.com/jkrumm/basalt-ui/commit/6924970f410b82ba5cfc65fd1d5088124934fc8f))

# [1.20.0](https://github.com/jkrumm/basalt-ui/compare/v1.19.1...v1.20.0) (2026-08-22)


### Bug Fixes

* exempt generated LINES, not files, and stop flagging prose as a typo'd id ([a83abfb](https://github.com/jkrumm/basalt-ui/commit/a83abfb77888f31528f44e5923b26d3710ddf005))
* give the mobile-nav-pill demo row its own glyph ([4620590](https://github.com/jkrumm/basalt-ui/commit/4620590204a99afd07ec27eb923cd229acdfce84))
* hold basalt to its own scoped theme-allow contract ([b67718c](https://github.com/jkrumm/basalt-ui/commit/b67718cecf8e7ce60b61b7481bcdbd4795f79d40))
* make the escape hatch and the generated-file marker fail closed ([526cdb7](https://github.com/jkrumm/basalt-ui/commit/526cdb7f11395f27183828e34297b0ac6bc846c8))
* make the mobile-nav active pill track density and survive an icon-less app ([0a7d756](https://github.com/jkrumm/basalt-ui/commit/0a7d7560f9eae6db4c02ff029ba47088a084e511))
* snapshot the tokens-only guard export ([b63dc24](https://github.com/jkrumm/basalt-ui/commit/b63dc242bfd46359476f7fcae80957db244f727f))


### Features

* demo the mobile-nav active pill with and without an icon dependency ([9620905](https://github.com/jkrumm/basalt-ui/commit/9620905409efdf39bb10b40edaa128ce2b61c741))
* make the escape hatch usable and close the holes round 4 found ([5b8420d](https://github.com/jkrumm/basalt-ui/commit/5b8420d24647b84818dfbb65e9f0c52ea1e79c2c))
* scan the app shell, wire the tokens-only profile, ship __APP_VERSION__ ([61b1792](https://github.com/jkrumm/basalt-ui/commit/61b1792e8ea1bff3c59128ba65137b27d40df81a))
* stop the toolchain reporting green while enforcing nothing ([d3d8e34](https://github.com/jkrumm/basalt-ui/commit/d3d8e3434893516e62413acafdd166be13b86541))

## [1.19.1](https://github.com/jkrumm/basalt-ui/compare/v1.19.0...v1.19.1) (2026-08-20)


### Bug Fixes

* cap the mobile bottom-sheet height to its content ([04093ac](https://github.com/jkrumm/basalt-ui/commit/04093ac902d894249ebea3e6381755497670e305))

# [1.19.0](https://github.com/jkrumm/basalt-ui/compare/v1.18.0...v1.19.0) (2026-08-20)


### Features

* make the mobile bar navigate, driven by one typed nav definition ([1ebba92](https://github.com/jkrumm/basalt-ui/commit/1ebba9267267ff26e988c876f17839b05d61689d))

# [1.18.0](https://github.com/jkrumm/basalt-ui/compare/v1.17.0...v1.18.0) (2026-08-19)


### Features

* render tooltips on cursor followers, and gate managed-doc drift ([6b46613](https://github.com/jkrumm/basalt-ui/commit/6b466136e1b1dbd88934d339420179768b3e9f8b)), closes [#52](https://github.com/jkrumm/basalt-ui/issues/52)

# [1.17.0](https://github.com/jkrumm/basalt-ui/compare/v1.16.0...v1.17.0) (2026-08-18)


### Features

* fix seven chart defects, six of them found by consumers ([c3df0b8](https://github.com/jkrumm/basalt-ui/commit/c3df0b8439c51effaf425c54644cd9a15328ef12))

# [1.16.0](https://github.com/jkrumm/basalt-ui/compare/v1.15.0...v1.16.0) (2026-08-18)


### Features

* close the chart-API gaps the first full consumer migration found ([518a086](https://github.com/jkrumm/basalt-ui/commit/518a086e632c7c010584071f5780d7aa3bbe3bc2))

# [1.15.0](https://github.com/jkrumm/basalt-ui/compare/v1.14.0...v1.15.0) (2026-08-18)


### Features

* add x-range chart bands, a dual-axis margin, and legend notes ([4883c19](https://github.com/jkrumm/basalt-ui/commit/4883c19d06a43d6a908efcf9fe8098610c86627a))
* make one cartesian primitive the whole chart contract ([4f8a507](https://github.com/jkrumm/basalt-ui/commit/4f8a507b2ca01923c1ee9bdf8a911ac0e5b76710))

# [1.14.0](https://github.com/jkrumm/basalt-ui/compare/v1.13.0...v1.14.0) (2026-08-10)


### Features

* let the sidebar host arbitrary content in its nav scroll region ([1b1a5f3](https://github.com/jkrumm/basalt-ui/commit/1b1a5f3f50cba0cf5f89e767d438dbd02adfe03f))

# [1.13.0](https://github.com/jkrumm/basalt-ui/compare/v1.12.0...v1.13.0) (2026-08-04)


### Bug Fixes

* hold the pack-test consumer inside the peer ranges it declares ([1fb3abe](https://github.com/jkrumm/basalt-ui/commit/1fb3abe09206cdd46a0a6f05cbbb9e3344c899f6))
* hold the virtual peer floor at the APIs the transcript calls ([324b474](https://github.com/jkrumm/basalt-ui/commit/324b47459b5717210464ffb5eb8b363bb152f87a))
* mint ids safely off a secure context and never wedge a stopped turn ([2d72074](https://github.com/jkrumm/basalt-ui/commit/2d7207403baa5a1aa5400355ac92417c9f767ffc))
* stop a hydrating store flashing empty and a cascade burying its cause ([93fe8c2](https://github.com/jkrumm/basalt-ui/commit/93fe8c261f5d027c003f1ce71108cd1bab1163e9))
* surface a failed thread load instead of an endless skeleton ([ea15873](https://github.com/jkrumm/basalt-ui/commit/ea15873fc797f237dd5d65ad1ffa5a781ff6e86c))


### Features

* give the transcript a Slack shape, affordances and virtualization ([33ca057](https://github.com/jkrumm/basalt-ui/commit/33ca057eb9fd78a59b369c1410b6e34ef0a04602))
* promote the agent guards and raw-scroll-container to error ([9ee8c44](https://github.com/jkrumm/basalt-ui/commit/9ee8c44acc2cc54973372dca5a8712dcf9def644))

# [1.12.0](https://github.com/jkrumm/basalt-ui/compare/v1.11.0...v1.12.0) (2026-08-03)


### Bug Fixes

* stop the tool-part fold carrying stale state and dropping parts ([d47a35f](https://github.com/jkrumm/basalt-ui/commit/d47a35f7d58d985037814b8771b0e426c5396403))


### Features

* give the composer its slots and a way to write into them ([e115b7e](https://github.com/jkrumm/basalt-ui/commit/e115b7efd428a09701307f9fe7448f72e69606bb))
* let a server-backed store stand behind the threads API ([dfdf9c5](https://github.com/jkrumm/basalt-ui/commit/dfdf9c543554167ff9d780dda2cb662238eff419))
* open the markdown seams and split trust from streaming ([90d406e](https://github.com/jkrumm/basalt-ui/commit/90d406e13311a107a6a160d8f66ff42e41085a75))
* prove the 1.12.0 seams from outside the package ([0231345](https://github.com/jkrumm/basalt-ui/commit/0231345f88f9d8f7191db6c733ac124d5fae85fd))

# [1.11.0](https://github.com/jkrumm/basalt-ui/compare/v1.10.0...v1.11.0) (2026-08-03)


### Features

* give every part a stable id and mirror v7's real tool lifecycle ([d63aac3](https://github.com/jkrumm/basalt-ui/commit/d63aac3267d2322dfd027ba9b78e730eeec95d30))
* make the transcript addressable, open, and honest about how a turn ended ([f153107](https://github.com/jkrumm/basalt-ui/commit/f1531077b411517226d2f349970677951d95bd59))
* promote the shade-index guard out of its grace period ([e6a7bf9](https://github.com/jkrumm/basalt-ui/commit/e6a7bf919a1c28246157f918b5462311b37bc192))
* prove the transcript layer from outside the package boundary ([52bd6d2](https://github.com/jkrumm/basalt-ui/commit/52bd6d2965e780d9d11008c6c449120285983c76))

# [1.10.0](https://github.com/jkrumm/basalt-ui/compare/v1.9.0...v1.10.0) (2026-08-02)


### Features

* open ./agent-chat as its own door, and put the agent layer under test ([2005aa6](https://github.com/jkrumm/basalt-ui/commit/2005aa6db90d02e9310188873027ecf8b93027ff))
* prove the agent-chat subpath and the streaming wedge in the playground ([caff9c4](https://github.com/jkrumm/basalt-ui/commit/caff9c4f4a3d92259a1e8a88348474c90dc4c18a))

# [1.9.0](https://github.com/jkrumm/basalt-ui/compare/v1.8.0...v1.9.0) (2026-08-02)


### Bug Fixes

* stop seeding repo-root files into a subdirectory package ([cd2fa7e](https://github.com/jkrumm/basalt-ui/commit/cd2fa7ea851eb1c73943e6bbdad5211b2fc65200))
* stop the layout guards firing where their remedy is banned ([6851a90](https://github.com/jkrumm/basalt-ui/commit/6851a908293cb5c46dc6e7c4c01185d3ac909928))


### Features

* capture chart hover through pointer events ([4f53f4b](https://github.com/jkrumm/basalt-ui/commit/4f53f4bd9ff2bb4ededb8db7ba9bf6049a62dc48))
* give charts a pending state ([c3a8d05](https://github.com/jkrumm/basalt-ui/commit/c3a8d05a4aac166d4264a8dc6b8afa2b45d1893b))
* let the date axis take a tick format ([5502ef5](https://github.com/jkrumm/basalt-ui/commit/5502ef5614e482a422b5f70e5701588d9612209e))
* portal the chart tooltip out of the svg namespace trap ([6e9c399](https://github.com/jkrumm/basalt-ui/commit/6e9c399d3d52c232765959386091d06379c35a98))
* resolve a sibling's hover key through a consumer seam ([c8b7c93](https://github.com/jkrumm/basalt-ui/commit/c8b7c93fb9cf0d56d940d0d466efa07a5b90508e))

# [1.8.0](https://github.com/jkrumm/basalt-ui/compare/v1.7.0...v1.8.0) (2026-08-02)


### Features

* give the stat card's threshold rail a good tone ([49e795f](https://github.com/jkrumm/basalt-ui/commit/49e795f2f0da85334953bf6280ca108c730d532c))

# [1.7.0](https://github.com/jkrumm/basalt-ui/compare/v1.6.0...v1.7.0) (2026-08-02)


### Bug Fixes

* correct the shipped depth and active-nav doctrine in the agent rules ([38e0f39](https://github.com/jkrumm/basalt-ui/commit/38e0f396012064aaee0ca7b252dabea3c281d5e3))


### Features

* close the three gaps that let a consumer fork the card idiom ([d83988b](https://github.com/jkrumm/basalt-ui/commit/d83988b12c38287c42b3c3148493c614380e27b9))

# [1.6.0](https://github.com/jkrumm/basalt-ui/compare/v1.5.0...v1.6.0) (2026-07-31)


### Bug Fixes

* **dev:** move marketing off the playground's port, allow the tailnet doors ([488f9e8](https://github.com/jkrumm/basalt-ui/commit/488f9e8d0824ff785c2eee1b2f43e7e456f9beca))


### Features

* quiet the active nav row into a selection ([767aed2](https://github.com/jkrumm/basalt-ui/commit/767aed2ec72ca92bfdbf5d0c30162b0f64d74e84))
* unify every interactive control on one raised depth ([7e6adc6](https://github.com/jkrumm/basalt-ui/commit/7e6adc6ef936f312f24112d4e15cd88e5d5d95b3))

# [1.5.0](https://github.com/jkrumm/basalt-ui/compare/v1.4.1...v1.5.0) (2026-07-28)


### Features

* normalise the emitted --vx-* names to kebab-case ([17bd239](https://github.com/jkrumm/basalt-ui/commit/17bd239bb3192c8b1a2f9dbd4f9ce513282df979))
* report the source declaration and unblind the chart kinds ([2d791f0](https://github.com/jkrumm/basalt-ui/commit/2d791f03f229e86eced5afda2f5ae90c8ec99533))
* ship zero runtime dependencies ([144327f](https://github.com/jkrumm/basalt-ui/commit/144327f76cb6a6bf863bed3d023181320a60246d))

## [1.4.1](https://github.com/jkrumm/basalt-ui/compare/v1.4.0...v1.4.1) (2026-07-28)


### Bug Fixes

* tell a spacing length apart from a dimensionless ratio ([d7629e5](https://github.com/jkrumm/basalt-ui/commit/d7629e5ec4b5d224accb31ac00a2e40d89de6dca))

# [1.4.0](https://github.com/jkrumm/basalt-ui/compare/v1.3.0...v1.4.0) (2026-07-28)


### Bug Fixes

* let the shipped pre-commit hook see CSS ([fd3341f](https://github.com/jkrumm/basalt-ui/commit/fd3341fd9e648ee30e512f38d47596c4d67b2d00))
* make inline-spacing read the CSS a consumer actually writes ([77c930d](https://github.com/jkrumm/basalt-ui/commit/77c930d16fe27b0e98bb0ac05c92e8e0653df723)), closes [#25](https://github.com/jkrumm/basalt-ui/issues/25)
* widen this repo's own pre-commit formatter to match its CI ([b25455e](https://github.com/jkrumm/basalt-ui/commit/b25455ef918b2953c10c996f468eb1fd41f91dae))


### Features

* give guard findings a severity so new rules can land soft ([1142ded](https://github.com/jkrumm/basalt-ui/commit/1142ded3f049054d316b3a8857c3fedc98a2fe46))
* have doctor report a spacing scale that moved under the app ([1e0ee4f](https://github.com/jkrumm/basalt-ui/commit/1e0ee4f1726fa4c358ec9bf6c22f075d1aebb665))

# [1.3.0](https://github.com/jkrumm/basalt-ui/compare/v1.2.0...v1.3.0) (2026-07-27)


### Bug Fixes

* realign the spacing guard with the retuned scale and CSS reality ([dc6918a](https://github.com/jkrumm/basalt-ui/commit/dc6918a8e5753ce6b5ebb187ccc97421293a0014))
* stop styles.css reaching past the framework's own chrome ([24f66dc](https://github.com/jkrumm/basalt-ui/commit/24f66dc0e0bb9bd8386235ee3a9e2974eb6b452c))


### Features

* add a core-only spacing emission mode to buildPaletteCss ([1a3d59b](https://github.com/jkrumm/basalt-ui/commit/1a3d59bb1558bb66771d3a51295993ab18084015))
* let buildPaletteCss target a custom color-scheme selector ([944a674](https://github.com/jkrumm/basalt-ui/commit/944a674c02a47b32c6badf7a2e000e4b0ccb26b3))
* make the react and mantine peers optional ([841f88f](https://github.com/jkrumm/basalt-ui/commit/841f88fdfed2ba946a72921b231bcdc427af173c))
* ship a prebuilt tokens.css and a tokens:css subcommand ([b23aca3](https://github.com/jkrumm/basalt-ui/commit/b23aca32b81cf4c9d580562cfc46b89a9c5a38da))

# [1.2.0](https://github.com/jkrumm/basalt-ui/compare/v1.1.1...v1.2.0) (2026-07-27)


### Bug Fixes

* let styles-block radii follow the dev radius slider ([81f0318](https://github.com/jkrumm/basalt-ui/commit/81f0318ede0fe60f8f95c89481090c7de990bfe2))
* make the raw-surface guard token-aware ([0deab9a](https://github.com/jkrumm/basalt-ui/commit/0deab9a24fcaae643419f89d075a103e6c078b97))
* make the virtual-list skeleton density-aware and lock the space var set ([f6fbde6](https://github.com/jkrumm/basalt-ui/commit/f6fbde634d2b1795d3a3f5cf3d3149b1eadac793))
* respect Vite's base when emitting app URLs ([488fe0c](https://github.com/jkrumm/basalt-ui/commit/488fe0cb39fa7dbd3d29d985aa264767fb952a0d))
* strip comments before the theme guard scans ([ac5e81d](https://github.com/jkrumm/basalt-ui/commit/ac5e81d414d7cfb290bd598f60bed1335f86234c))


### Features

* add basaltAppPlugin for PWA head, manifest, and icon metadata ([cef0114](https://github.com/jkrumm/basalt-ui/commit/cef0114e85f7d2107c640bdfb24978e6b0d29d40))
* add fonts option and derive legendText ([82a6af3](https://github.com/jkrumm/basalt-ui/commit/82a6af3eaba65ad86dcf18ec3aa94f8d798b3d4e))
* add per-rule path exemptions to the theme guard ([5f085bb](https://github.com/jkrumm/basalt-ui/commit/5f085bb2ae919f09fafac473818cb3874704d5b1))
* add the density knob to the theme config ([e992638](https://github.com/jkrumm/basalt-ui/commit/e992638b5897b8a7a12d4c142aad513bff6d0ca9))
* add the radius knob to the theme config ([3207e8a](https://github.com/jkrumm/basalt-ui/commit/3207e8a8b3e4c718e815fa9a1dd5f2540f88ffbc))
* derive the palette from one accent seed ([bc6fe31](https://github.com/jkrumm/basalt-ui/commit/bc6fe31e892f626e48f3dc60ff5351fa5805ace1))
* dogfood the inline-display and raw-html-layout guards ([4844f62](https://github.com/jkrumm/basalt-ui/commit/4844f62db7a2762c2c40973c2b612fecc33031b9))
* dogfood the inline-spacing guard on the package ([583e18c](https://github.com/jkrumm/basalt-ui/commit/583e18c21c12ba0858b9d31ef7fc433c127bc2fd))
* dogfood the raw-spacing guard on the package ([c9a2cf9](https://github.com/jkrumm/basalt-ui/commit/c9a2cf9f7bfd6cfd2a284cf1ec57295c55ad6f14))
* dogfood the raw-surface guard on the package ([b70a29a](https://github.com/jkrumm/basalt-ui/commit/b70a29aa048227fa048c0acdfc0847a69d9f9f5b))
* embed DeriveControls in playground settings ([8439aa1](https://github.com/jkrumm/basalt-ui/commit/8439aa1b8b94409d2c1047ccf697aceec4068b40))
* make the theme lab move the theme object, not just CSS vars ([1eb4257](https://github.com/jkrumm/basalt-ui/commit/1eb4257a9525094b386f80699e8282c53982e974))
* mention the radius knob in the Derive panel copy ([7a1b064](https://github.com/jkrumm/basalt-ui/commit/7a1b064c548f98143350d366696eb1f7ab8e6b6f))
* scan CSS modules in the theme guard ([2b0d9d4](https://github.com/jkrumm/basalt-ui/commit/2b0d9d433917ef5bcc55d0400e76de50f622c526))
* tighten the sidebar, open up components — retune the level-0 spacing bases ([8b6119a](https://github.com/jkrumm/basalt-ui/commit/8b6119aa601793f8947302288d02cfb1803dc1b8))

## [1.1.1](https://github.com/jkrumm/basalt-ui/compare/v1.1.0...v1.1.1) (2026-07-17)


### Bug Fixes

* derive consumer seeds from basalt.roots, relax eqeqeq to smart ([b598112](https://github.com/jkrumm/basalt-ui/commit/b5981124b5758cca421164037d4f320ed65af362))

# [1.1.0](https://github.com/jkrumm/basalt-ui/compare/v1.0.2...v1.1.0) (2026-07-17)


### Features

* split the import boundary into three independent rules ([784b673](https://github.com/jkrumm/basalt-ui/commit/784b6739367a25b9ffe379603c02322896e43658))

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
