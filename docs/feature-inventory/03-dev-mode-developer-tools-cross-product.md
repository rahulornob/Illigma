# Dev Mode, developer tools, and cross-product features

## Figma MCP server

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| MCP server: remote | Hosted endpoint https://mcp.figma.com/mcp; broadest feature set; available on all seats and plans | Local: embedded local MCP server, no auth | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| MCP server: desktop/local | Runs via desktop app at http://127.0.0.1:3845/mcp; enabled from Dev Mode right sidebar; Dev/Full seat | P1 | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| MCP server: enable toggle in Dev Mode | Nothing selected, Dev Mode right sidebar toggle starts server; confirmation toast with Copy URL button | P1 | [Claude Code and Figma: Set up the MCP server](https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server) |
| MCP server: OAuth authentication | Client opens browser, user clicks Allow access to grant client access to account | Local: N/A, no accounts | [Claude Code and Figma: Set up the MCP server](https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server) |
| MCP setup: Claude Code | `claude plugin install figma@claude-plugins-official` or `claude mcp add --transport http figma-desktop <url>` | P1 | [Claude Code and Figma: Set up the MCP server](https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server) |
| MCP setup: Codex | Codex Plugins > + Figma; or Settings > MCP servers > Streamable HTTP server named figma-desktop | P1 | [Codex and Figma: Set up the MCP server](https://help.figma.com/hc/en-us/articles/39888629089175-Codex-and-Figma-Set-up-the-MCP-server) |
| MCP setup: Cursor | /add-plugin figma in chat; or Cursor Settings > MCP > Add Custom MCP JSON mcpServers entry | P1 | [Cursor and Figma: Set up the MCP server](https://help.figma.com/hc/en-us/articles/39889260656407-Cursor-and-Figma-Set-up-the-MCP-server) |
| MCP setup: Gemini CLI | `gemini extensions install` repo URL, `/mcp auth figma`; uninstall via extensions uninstall | P1 | [Gemini CLI and Figma: Set up the MCP server](https://help.figma.com/hc/en-us/articles/39889246888855-Gemini-CLI-and-Figma-Set-up-the-MCP-server) |
| MCP setup: VS Code | mcp.json servers entry type http; Start button triggers auth; requires GitHub Copilot; global or workspace scope | P1 | [VS Code and Figma: Set up the MCP server](https://help.figma.com/hc/en-us/articles/39890361040535-VS-Code-and-Figma-Set-up-the-MCP-server) |
| MCP setup: Xcode | Xcode 27 beta only; Settings > Intelligence > Plug-ins > Add from URL; one-click setup | P2 | [Xcode and Figma: Set up the MCP server](https://help.figma.com/hc/en-us/articles/41061095668759-Xcode-and-Figma-Set-up-the-MCP-server) |
| MCP: supported clients matrix | ~19 clients (Amazon Q, Android Studio, Augment, Claude Code/Desktop, Codex, Copilot CLI, Cursor, Kiro, Warp, etc.) | P1 | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| MCP: rate/usage limits | Usage and rate limits per plan and seat documented in developer docs | Local: N/A, no rate limits | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| MCP: font access | Server and agent can use fonts uploaded to the account; local-only fonts not accessible | Local: use system/local fonts directly | [Figma MCP server FAQs](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs) |
| MCP: get design context | Extract components, variables, layout data from a node identified by link-to-selection node ID | P1 | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| MCP: generate code from frame | Select frame, turn it into code via agent | P1 | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| MCP: link-based node targeting | Copy link to selection; client extracts node ID from URL to target object | P1 | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| MCP: get_screenshot | Returns PNG (inline base64 supported) so agent can see a design | P1 | [Figma MCP server FAQs](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs) |
| MCP: download_assets | Downloadable URLs for multiple nodes; SVG, PDF, JPG, PNG; raw mode returns original uploaded fill images | P1 | [Figma MCP server FAQs](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs) |
| MCP: upload_assets | Upload raw image assets into files, e.g. transfer images between files | P1 | [Figma MCP server FAQs](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs) |
| MCP: write to canvas (use_figma) | Agent executes Plugin API code to create/modify frames, components, variables, auto layout using design system | P1 | [Figma MCP server FAQs](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs) |
| MCP write: seat rules | Full seat writes anywhere; Dev seat read-only outside drafts | Local: N/A, no seats | [Figma MCP server FAQs](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs) |
| MCP write: limits | 20kb output response per call; no image/video assets yet; beta quality; components must be published for Code Connect | P1 | [Figma MCP server FAQs](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs) |
| MCP write: image placeholders | Images unsupported in use_figma; gray placeholder boxes generated instead | P1 | [Figma MCP server FAQs](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs) |
| MCP: code to canvas (generate_figma_design) | Capture running web app (prod, staging, localhost) as flat editable layers; no library link | P2 | [Figma MCP server FAQs](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs) |
| MCP: capture toolbar | Browser toolbar to capture pages, elements, states and whole flows into a new Figma file | P2 | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| MCP: retrieve FigJam resources | Read FigJam diagrams/content as context for code generation | Module | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| MCP: retrieve Make resources | Read code resources from Make files as LLM context | Module | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| MCP: Code Connect integration | Generated code reuses mapped real codebase components | P2 | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| MCP: generate_diagram tool | Creates FigJam flowchart from prompt | Module | [Get started with the Figma MCP server](https://help.figma.com/hc/en-us/articles/39216419318551-Get-started-with-the-Figma-MCP-server) |
| MCP: write to FigJam and Slides | Agents create/modify native FigJam and Slides content | Module | [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |

## MCP skills

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Skills: concept | Markdown instruction files teaching agents Figma workflows; anyone can author/share, no approval | P1 | [Figma MCP server FAQs](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs) |
| Skills: distribution | Bundled with client plugin, downloadable zip, GitHub repo, Figma Community skills | P1 | [Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895-Figma-skills-for-MCP) |
| Skill: figma-use | Foundational write-to-canvas skill: frames, components, variables, auto layout; needs file URL and edit access | P1 | [Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895-Figma-skills-for-MCP) |
| Skill: figma-use-figjam | Foundational FigJam skill: stickies, sections, connectors, shapes, tables, code blocks | Module | [Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895-Figma-skills-for-MCP) |
| Skill: figma-use-slides | Slides skill: slides, sections, themes, text styles, speaker notes in Presenter View | Module | [Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895-Figma-skills-for-MCP) |
| Skill: figma-swiftui | Bidirectional Figma <-> SwiftUI; maps NavigationStack, TabView, SF Symbols, iOS HIG semantic colors | P2 | [Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895-Figma-skills-for-MCP) |
| Skill: figma-code-connect | Scans codebase, proposes component mappings, creates in bulk; needs published library, Org/Enterprise | P2 | [Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895-Figma-skills-for-MCP) |
| Skill: figma-create-new-file | /figma-create-new-file [design\|figjam] [name]; creates blank file in drafts, returns link | P1 | [Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895-Figma-skills-for-MCP) |
| Skill: figma-generate-diagram | Flowchart, sequence, ER, state, Gantt diagrams as editable FigJam nodes and connectors | Module | [Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895-Figma-skills-for-MCP) |
| Skill: figma-generate-library | Phased library build from codebase: discovery, foundations, file structure, components, Code Connect QA | P2 | [Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895-Figma-skills-for-MCP) |
| Skill: figma-generate-library pages | Creates Cover, Getting Started, Foundations, Components, Utilities pages with swatch/type/spacing docs | P2 | [Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895-Figma-skills-for-MCP) |
| Skill: figma-generate-design | Builds full screens from codebase views using real components; screenshots live web app for reference | P2 | [Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895-Figma-skills-for-MCP) |

## Plugins: development

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Plugins: Plugin API | Fixed controlled endpoints giving read/write access to files; stable across releases | P1 | [About building plugins in Figma](https://help.figma.com/hc/en-us/articles/41407987481879-About-building-plugins-in-Figma) |
| Plugins: external web APIs | Plugins may call third-party web APIs (e.g. Google Maps) | P1 | [About building plugins in Figma](https://help.figma.com/hc/en-us/articles/41407987481879-About-building-plugins-in-Figma) |
| Plugins: manual invocation | Short-lived, always user-invoked; run immediately or after user input | P1 | [About building plugins in Figma](https://help.figma.com/hc/en-us/articles/41407987481879-About-building-plugins-in-Figma) |
| Plugins: classic vs generative | Classic: local code, full UI, network, monetization; generative: agent-built, PropsKit UI, no third-party APIs | P1 | [About building plugins in Figma](https://help.figma.com/hc/en-us/articles/41407987481879-About-building-plugins-in-Figma) |
| Plugins: desktop-only development | Create/publish plugins only from desktop app (macOS, Windows) | Local: desktop app is the only app | [Build classic plugins for the Figma Community](https://help.figma.com/hc/en-us/articles/360039958874-Build-classic-plugins-for-the-Figma-Community) |
| Plugin: New Plugin from template | Menu > Plugins > Development > New Plugin...; generates folder with critical files | P1 | [Create a classic plugin for development](https://help.figma.com/hc/en-us/articles/360042786733-Create-a-classic-plugin-for-development) |
| Plugin: import from manifest | Import new plugin from manifest... for existing source on disk | P1 | [Create a classic plugin for development](https://help.figma.com/hc/en-us/articles/360042786733-Create-a-classic-plugin-for-development) |
| Plugin: editor type | Choose Multi-product or product-specific (Design, FigJam, Slides, Buzz, Dev Mode) | P1 | [Create a classic plugin for development](https://help.figma.com/hc/en-us/articles/360042786733-Create-a-classic-plugin-for-development) |
| Plugin templates: Design | Default (blank), Run once (no UI), Custom UI (interactive UI, browser APIs) | P1 | [Create a classic plugin for development](https://help.figma.com/hc/en-us/articles/360042786733-Create-a-classic-plugin-for-development) |
| Plugin templates: Dev Mode | Inspect (UI in inspect panel Plugins tab), Code Generator (snippets in inspect panel) | P2 | [Create a classic plugin for development](https://help.figma.com/hc/en-us/articles/360042786733-Create-a-classic-plugin-for-development) |
| Plugin: Development section | Dev plugins listed under Development in Plugins tab of every product | P1 | [Create a classic plugin for development](https://help.figma.com/hc/en-us/articles/360042786733-Create-a-classic-plugin-for-development) |
| Plugin: Locate local version | Point to manifest.json on disk to relink a dev plugin | P1 | [Manage classic plugins as a developer](https://help.figma.com/hc/en-us/articles/360042293714-Manage-classic-plugins-as-a-developer) |
| Plugin: Remove in development | Delete dev plugin registration; manifest remains on disk; irreversible | P1 | [Manage classic plugins as a developer](https://help.figma.com/hc/en-us/articles/360042293714-Manage-classic-plugins-as-a-developer) |
| Plugin parameters | Plugins accept typed user input via quick actions (Cmd/Ctrl+/) without custom UI | P1 | [Plugin parameters](https://help.figma.com/hc/en-us/articles/4406468726167-Plugin-parameters) |
| Plugin parameters: parameter-only plugins | Plugins with no UI beyond quick actions; publishable to Community | P1 | [Plugin parameters](https://help.figma.com/hc/en-us/articles/4406468726167-Plugin-parameters) |
| Plugin examples (ecosystem) | Content replace, style swap, data fill, maps, animation, WCAG 2.1 contrast checking | P2 | [Build classic plugins for the Figma Community](https://help.figma.com/hc/en-us/articles/360039958874-Build-classic-plugins-for-the-Figma-Community) |

## Plugins: publishing and security

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Plugin: publish to Community | Submit for review; after approval updates publish immediately without re-review | Local: plugin registry or git install | [Manage classic plugins as a developer](https://help.figma.com/hc/en-us/articles/360042293714-Manage-classic-plugins-as-a-developer) |
| Plugin: Publish new version | Updates for all users; users cannot revert; roll back by republishing older version | Local: versioned local plugin folders | [Manage classic plugins as a developer](https://help.figma.com/hc/en-us/articles/360042293714-Manage-classic-plugins-as-a-developer) |
| Plugin: release notes | Optional release notes on Add final details page per version | P2 | [Manage classic plugins as a developer](https://help.figma.com/hc/en-us/articles/360042293714-Manage-classic-plugins-as-a-developer) |
| Plugin: edit Community page | Edit name, description, tags, artwork without publishing update | Local: N/A, no community | [Manage classic plugins as a developer](https://help.figma.com/hc/en-us/articles/360042293714-Manage-classic-plugins-as-a-developer) |
| Plugin: additional publishers | Invite others to publish updates | Local: N/A, no accounts | [Manage classic plugins as a developer](https://help.figma.com/hc/en-us/articles/360042293714-Manage-classic-plugins-as-a-developer) |
| Plugin: transfer ownership | Private org plugins transferable; former owner becomes Can update | Local: N/A, no accounts | [Manage classic plugins as a developer](https://help.figma.com/hc/en-us/articles/360042293714-Manage-classic-plugins-as-a-developer) |
| Plugin: unpublish | Removes for all users, no notification; likes/installs kept, details lost; paid plugins only delisted | Local: N/A, no community | [Manage classic plugins as a developer](https://help.figma.com/hc/en-us/articles/360042293714-Manage-classic-plugins-as-a-developer) |
| Plugin: private org publishing | Admins publish plugins privately to organization | Local: shared plugin folder | [About building plugins in Figma](https://help.figma.com/hc/en-us/articles/41407987481879-About-building-plugins-in-Figma) |
| Plugin: monetization | Optional paid classic plugins; ownership of paid plugins non-transferable | Local: N/A, no marketplace | [Build classic plugins for the Figma Community](https://help.figma.com/hc/en-us/articles/360039958874-Build-classic-plugins-for-the-Figma-Community) |
| Plugin: sell source code | Buyer/seller request via support; support transfers ownership | Local: N/A, no marketplace | [Build classic plugins for the Figma Community](https://help.figma.com/hc/en-us/articles/360039958874-Build-classic-plugins-for-the-Figma-Community) |
| Plugin: purpose lock | Published plugin cannot materially change purpose; needs new plugin and review | Local: N/A, no review | [Build classic plugins for the Figma Community](https://help.figma.com/hc/en-us/articles/360039958874-Build-classic-plugins-for-the-Figma-Community) |
| Plugin: support contact | Required support email or URL at submission | Local: N/A, manifest homepage field | [Manage classic plugins as a developer](https://help.figma.com/hc/en-us/articles/360042293714-Manage-classic-plugins-as-a-developer) |
| Security disclosure form | Voluntary data-practice form shown on Community listing after approval (up to 2 weeks review) | Local: manifest permission declaration | [Security disclosure principles](https://help.figma.com/hc/en-us/articles/16354660649495-Security-disclosure-principles) |
| Security: HTTPS-only network | All plugin/widget external requests should use HTTPS, never HTTP | P1 | [Security disclosure principles](https://help.figma.com/hc/en-us/articles/16354660649495-Security-disclosure-principles) |
| Security: network domain allowlist | Restrict network access to required domains only | P1 | [Security disclosure principles](https://help.figma.com/hc/en-us/articles/16354660649495-Security-disclosure-principles) |
| Security: plugin storage | Use Figma-provided storage for plugin data where possible | P1 | [Security disclosure principles](https://help.figma.com/hc/en-us/articles/16354660649495-Security-disclosure-principles) |
| Security: auth via trusted provider | OAuth 2.0/Auth0 recommended when plugin authenticates users | P2 | [Security disclosure principles](https://help.figma.com/hc/en-us/articles/16354660649495-Security-disclosure-principles) |
| Security: disclosure questions | Backend hosting, vuln process, SOC 2/ISO certs, third-party requests, auth, data storage, update process | Local: N/A, no review | [Security disclosure principles](https://help.figma.com/hc/en-us/articles/16354660649495-Security-disclosure-principles) |

## Widgets

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Widgets: concept | Persistent interactive custom objects on Design/FigJam canvas, visible and usable by everyone; repositionable | P2 | [Make widgets for the Figma Community](https://help.figma.com/hc/en-us/articles/4410596533143-Make-widgets-for-the-Figma-Community) |
| Widgets: use cases | CSV-to-table/visualization, polls/voting, calendars/timelines, mind maps, org charts, games | P2 | [Make widgets for the Figma Community](https://help.figma.com/hc/en-us/articles/4410596533143-Make-widgets-for-the-Figma-Community) |
| Widgets: tech stack | JavaScript on Plugin API; JSX + TypeScript recommended | P2 | [Make widgets for the Figma Community](https://help.figma.com/hc/en-us/articles/4410596533143-Make-widgets-for-the-Figma-Community) |
| Widget: create from template | Right-click or menu > Widgets > Development > New widget; saves source folder to disk | P2 | [Create a widget for development](https://help.figma.com/hc/en-us/articles/4410676552727-Create-a-widget-for-development) |
| Widget: product target | Figma Design + FigJam, Figma Design only, or FigJam only | P2 | [Create a widget for development](https://help.figma.com/hc/en-us/articles/4410676552727-Create-a-widget-for-development) |
| Widget templates | Empty, Simple widget (click actions), With iFrame & browser APIs | P2 | [Create a widget for development](https://help.figma.com/hc/en-us/articles/4410676552727-Create-a-widget-for-development) |
| Widget: generated files | manifest.json, code.ts, code.js, package.json, tsconfig.json, README.md; code not stored by Figma | P2 | [Create a widget for development](https://help.figma.com/hc/en-us/articles/4410676552727-Create-a-widget-for-development) |
| Widget: import from manifest | Right-click, file menu or quick actions > Import widget from manifest | P2 | [Create a widget for development](https://help.figma.com/hc/en-us/articles/4410676552727-Create-a-widget-for-development) |
| Widget: Reveal in Finder | Open folder containing dev widget's manifest | P2 | [Create a widget for development](https://help.figma.com/hc/en-us/articles/4410676552727-Create-a-widget-for-development) |
| Widget: insert dev widget | Click/drag from Widgets tab, right-click menu, or quick actions search | P2 | [Create a widget for development](https://help.figma.com/hc/en-us/articles/4410676552727-Create-a-widget-for-development) |
| Widget: publish/update/unpublish | Same as plugins; only original publisher can publish updates; no user rollback | Local: N/A, no community | [Manage widgets as a developer](https://help.figma.com/hc/en-us/articles/4410592119703-Manage-widgets-as-a-developer) |
| Widget: creators list | List contributors as creators without publish rights | Local: N/A, no community | [Manage widgets as a developer](https://help.figma.com/hc/en-us/articles/4410592119703-Manage-widgets-as-a-developer) |

## Dev Mode: interface and navigation

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Dev Mode: toggle | Toolbar toggle or Shift+D to enter/exit developer inspect workspace | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Dev Mode: deep link | Opening a Dev Mode link drops user straight into Dev Mode | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Dev Mode: page ready indicator | Icon marks pages containing ready-for-dev sections/frames/components | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Dev Mode: Ready for development list | Left sidebar groups ready items under Ready for development | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Dev Mode: section prioritization | Content in sections shown first; content outside sections collapsed by default | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Dev Mode: last edited time | Frame last-edited time shown under name in nav panel and inspect header | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Dev Mode: click to center frame | Clicking frame in sidebar centers it; selecting frame switches to its layers panel | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Dev Mode: frame arrow navigation | Left/right arrow keys or on-screen arrows move between top-level frames | P1 | [Navigate designs in Dev Mode](https://help.figma.com/hc/en-us/articles/15023152204951-Navigate-designs-in-Dev-Mode) |
| Dev Mode: hover layout info | Hover reveals size, padding, spacing; shows distances from selection | P1 | [Navigate designs in Dev Mode](https://help.figma.com/hc/en-us/articles/15023152204951-Navigate-designs-in-Dev-Mode) |
| Dev Mode: search | Cmd/Ctrl+F; searches file and accessible libraries; live results | P0 | [Navigate designs in Dev Mode](https://help.figma.com/hc/en-us/articles/15023152204951-Navigate-designs-in-Dev-Mode) |
| Search: scope | Current page or all pages | P0 | [Navigate designs in Dev Mode](https://help.figma.com/hc/en-us/articles/15023152204951-Navigate-designs-in-Dev-Mode) |
| Search: type filters | Filter by layer type (text, frame, shape, etc.); Other for widgets, slices | P0 | [Navigate designs in Dev Mode](https://help.figma.com/hc/en-us/articles/15023152204951-Navigate-designs-in-Dev-Mode) |
| Search: result stepping | Up/down arrows step results; Esc returns to navigation | P0 | [Navigate designs in Dev Mode](https://help.figma.com/hc/en-us/articles/15023152204951-Navigate-designs-in-Dev-Mode) |
| Dev Mode: version history access | File name menu > version history to inspect any version | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Dev Mode: view aids | Layout guides, rulers, layer outlines available in Dev Mode | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Dev Mode: Plugins tab | Recently used and recommended Dev Mode plugins (Jira, Storybook, GitHub, Tailwind/React codegen) | P2 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Dev Mode: seat access | Full or Dev seat; Collab/View seats get basic inspection only; not on Starter | Local: N/A, all features free | [Dev Mode for admins](https://help.figma.com/hc/en-us/articles/19813618057623-Dev-Mode-for-admins) |
| Dev Mode: seat requests | Users request Dev access; admins approve via seat settings | Local: N/A, no seats | [Dev Mode for admins](https://help.figma.com/hc/en-us/articles/19813618057623-Dev-Mode-for-admins) |
| Dev Mode: focus view | Isolates one ready-for-dev design with toolbar, Inspect/Plugins tabs, layers, scoped history | P2 | [Dev Mode focus view](https://help.figma.com/hc/en-us/articles/23919923330455-Dev-Mode-focus-view) |
| Focus view: open | From Ready for dev list, Open in focus view on frame, or Show in focus view from status | P2 | [Dev Mode focus view](https://help.figma.com/hc/en-us/articles/23919923330455-Dev-Mode-focus-view) |
| Focus view: copy link | Shareable link to focused design | P2 | [Dev Mode focus view](https://help.figma.com/hc/en-us/articles/23919923330455-Dev-Mode-focus-view) |
| Focus view: navigation | See all ready for dev; Inspect on page; back returns to prior canvas position | P2 | [Dev Mode focus view](https://help.figma.com/hc/en-us/articles/23919923330455-Dev-Mode-focus-view) |
| Focus view: layer panel | Layer panel appears when parts of the design are selected | P2 | [Dev Mode focus view](https://help.figma.com/hc/en-us/articles/23919923330455-Dev-Mode-focus-view) |
| Focus view: interactive resize | Temporarily resize top-level frame by values or handles; private, resets on exit | P1 | [Dev Mode focus view](https://help.figma.com/hc/en-us/articles/23919923330455-Dev-Mode-focus-view) |
| Focus view: preview variable modes | Dropdown to preview design in other modes (light/dark), temporary and private | P1 | [Dev Mode focus view](https://help.figma.com/hc/en-us/articles/23919923330455-Dev-Mode-focus-view) |
| Focus view: scoped version history | Version history filtered to versions affecting this design, with status notes | P2 | [Dev Mode focus view](https://help.figma.com/hc/en-us/articles/23919923330455-Dev-Mode-focus-view) |
| Focus view: Mark as completed | Button records completion in history; design stays in list | P2 | [Dev Mode focus view](https://help.figma.com/hc/en-us/articles/23919923330455-Dev-Mode-focus-view) |
| Ready for dev view | Left sidebar list of all designs with dev status in a file, with counter | P2 | [Dev Mode ready for dev view](https://help.figma.com/hc/en-us/articles/23918228264855-Dev-Mode-ready-for-dev-view) |
| Ready for dev view: filters | All, Ready, Completed | P2 | [Dev Mode ready for dev view](https://help.figma.com/hc/en-us/articles/23918228264855-Dev-Mode-ready-for-dev-view) |
| Ready for dev view: sort | Recent activity, Pages, Name (A-Z) | P2 | [Dev Mode ready for dev view](https://help.figma.com/hc/en-us/articles/23918228264855-Dev-Mode-ready-for-dev-view) |
| Ready for dev view: recency highlight | Highlights when design was last updated since handoff | P2 | [Dev Mode ready for dev view](https://help.figma.com/hc/en-us/articles/23918228264855-Dev-Mode-ready-for-dev-view) |

## Dev Mode: inspect panel and variables

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Inspect: layer header | Selected layer name, type (component, instance, frame, text) and last-updated time | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Inspect: Compare with main component | For instances; compare detached component to history and former main; clear detachment history | P2 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Inspect: component info | Keywords, main component layout, variant info, component properties, link to main, docs links | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Inspect: component playground | Explore component behavior: try properties and variable modes without changing design | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Inspect: layer properties Code/List toggle | Show properties as code (default) or list; click list values to copy | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Inspect: properties content | Layout, spacing, colors, typography, text strings, component props, styles, variables, prototype interactions | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Inspect: typography preview / box model | Code section shows type preview or box model before snippets | P1 | [Guide to inspecting](https://help.figma.com/hc/en-us/articles/22012921621015-Guide-to-inspecting) |
| Inspect: applied styles and variables | Lists styles and variables on selection with details and suggestions | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Inspect: copy/share restriction | Code section hidden when copying and sharing disabled on file | Local: N/A, no sharing controls | [Guide to inspecting](https://help.figma.com/hc/en-us/articles/22012921621015-Guide-to-inspecting) |
| Inspect: Properties tab (view-only, Design mode) | View-only users see layout, color, type, text, component props, styles, variables | P0 | [Guide to inspecting](https://help.figma.com/hc/en-us/articles/22012921621015-Guide-to-inspecting) |
| Copy as code (Design mode) | Right-click > Copy/Paste as > Copy as code: CSS, iOS, Android | P1 | [Guide to inspecting](https://help.figma.com/hc/en-us/articles/22012921621015-Guide-to-inspecting) |
| Inspect: comments | C for comment mode; pin point or drag region; @mentions | Local: P2 local notes, no accounts | [Guide to inspecting](https://help.figma.com/hc/en-us/articles/22012921621015-Guide-to-inspecting) |
| Inspect: export settings | + export configs, multiple per selection; Preview (single selection); nothing selected exports page | P0 | [Guide to inspecting](https://help.figma.com/hc/en-us/articles/22012921621015-Guide-to-inspecting) |
| Inspect: export formats | PNG, JPG, SVG, PDF | P0 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Inspect: auto icon detection | Detects icons as downloadable assets; toggle via Main menu > View > Automatically detect icons | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Inspect: Assets download | Hover asset, choose file type, download; GIF and MP4 nodes downloadable | P1 | [Guide to Dev Mode in Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma) |
| Inspect: image export size | Source image file (original full-res) or Layer export (PNG, JPEG, SVG, PDF) | P1 | [Guide to inspecting](https://help.figma.com/hc/en-us/articles/22012921621015-Guide-to-inspecting) |
| Inspect: annotations display | Annotations shown as green dots on canvas; click to reveal | P1 | [Guide to inspecting](https://help.figma.com/hc/en-us/articles/22012921621015-Guide-to-inspecting) |
| Variable details modal | Name, host file link, collection, mode, value, alias chain to raw value, scope, code snippet | P1 | [Variables in Dev Mode](https://help.figma.com/hc/en-us/articles/27882809912471-Variables-in-Dev-Mode) |
| Variable details: switch mode | Change mode in modal to see other values | P1 | [Variables in Dev Mode](https://help.figma.com/hc/en-us/articles/27882809912471-Variables-in-Dev-Mode) |
| Variable details: open | Click variable name in code snippet or Variable details icon in Selection colors | P1 | [Variables in Dev Mode](https://help.figma.com/hc/en-us/articles/27882809912471-Variables-in-Dev-Mode) |
| Suggested variables | Click raw value to suggest variables with exact same value and appropriate scope; click copies name | P1 | [Variables in Dev Mode](https://help.figma.com/hc/en-us/articles/27882809912471-Variables-in-Dev-Mode) |
| Read-only variables table | No selection > Open variables table; view collections, modes; click to copy | P1 | [Variables in Dev Mode](https://help.figma.com/hc/en-us/articles/27882809912471-Variables-in-Dev-Mode) |
| Dev code: font weight from string variable | String weight variables emitted as numeric weight, no var reference; invalid falls back to 400 | P1 | [Variables in Dev Mode](https://help.figma.com/hc/en-us/articles/27882809912471-Variables-in-Dev-Mode) |
| Dev code: variable name normalization | Names normalized for valid CSS, e.g. emoji/spaces stripped to --blue-0000FF | P1 | [Variables in Dev Mode](https://help.figma.com/hc/en-us/articles/27882809912471-Variables-in-Dev-Mode) |

## Dev Mode: code snippets and dev resources

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Code snippets: Code section | Auto-generated code for selection; text shows type preview, others box model (margin, border, padding) | P1 | [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| Code snippets: languages | CSS (Web), SwiftUI, UIKit (iOS), Compose, XML (Android) | P1 | [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| Code snippets: default language/unit | Set with nothing selected; per-selection override via dropdown | P1 | [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| Code snippets: units | CSS px, rem; iOS px, pt; Android px, dp, sp | P1 | [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| Code snippets: unit scale | Set unit scale... e.g. root font size for rem (1rem=16px default), iOS point scale | P1 | [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| Code snippets: variables in code | Variables emitted using code syntax names | P1 | [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| Code snippets: copy | Hover snippet > Copy | P1 | [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| Code snippets: codegen plugins | Plugins add languages/custom snippets via Plugin API; selectable in language dropdown | P2 | [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| Code snippets: Code Connect "connected" | Connected components show library snippets labeled connected instead of autogen | P2 | [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| Dev resources | Attach external links (GitHub, Jira, Storybook, VS Code) to any layer | P1 | [Link Dev resources to layers in Dev Mode](https://help.figma.com/hc/en-us/articles/15023231995927-Link-Dev-resources-to-layers-in-Dev-Mode) |
| Dev resources: inheritance | Links on main component inherited by all instances; instance links stay local | P1 | [Link Dev resources to layers in Dev Mode](https://help.figma.com/hc/en-us/articles/15023231995927-Link-Dev-resources-to-layers-in-Dev-Mode) |
| Dev resources: add/remove | Layer options > Add a dev resource link, paste, Enter; ... > Delete link | P1 | [Link Dev resources to layers in Dev Mode](https://help.figma.com/hc/en-us/articles/15023231995927-Link-Dev-resources-to-layers-in-Dev-Mode) |
| Dev resources: plugin launch | Link with related plugin auto-opens that plugin in Plugins tab | P2 | [Link Dev resources to layers in Dev Mode](https://help.figma.com/hc/en-us/articles/15023231995927-Link-Dev-resources-to-layers-in-Dev-Mode) |

## Dev Mode: measurements and annotations

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Measurement tool | Shift+M; drag between layers to place persistent visible measurement; draggable label | P1 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Measurement: custom text | Double-click measurement to edit its label | P1 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Measurement: delete | Select and press Delete/Backspace | P1 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Measure: Alt/Option hover | Temporary distance between selection and hovered layer; not saved | P0 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Annotation tool | Shift+T; attach note to layer with free text and/or live properties via + Property | P1 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Annotation: live properties | Annotated property values stay in sync when design changes | P1 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Annotation categories | Presets: Development, Interaction, Accessibility, Content; per-file, editable/deletable | P1 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Annotation categories: custom | Edit categories... add color and name | P1 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Annotation categories: copy behavior | Copying annotated layers carries categories; new category made if color+label unmatched | P1 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Annotations: filter by category | Right-click > Filter by, or Dev Mode zoom menu > Annotations | P1 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Annotations: hide | Main menu > View > Annotations toggle | P1 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Annotations: Plugin API | Plugins can create/manage annotations in bulk | P2 | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |
| Annotations: permissions | Full seat + edit to add; Full/Dev + view to see | Local: N/A, no seats | [Add measurements and annotate designs](https://help.figma.com/hc/en-us/articles/20774752502935-Add-measurements-and-annotate-designs) |

## Dev Mode: compare changes

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Compare changes | Inspect tab > Compare changes for top-level frame or component vs earlier version | P2 | [Compare changes in Dev Mode](https://help.figma.com/hc/en-us/articles/15023193382935-Compare-changes-in-Dev-Mode) |
| Compare: two components | Shift-click two components to compare them | P2 | [Compare changes in Dev Mode](https://help.figma.com/hc/en-us/articles/15023193382935-Compare-changes-in-Dev-Mode) |
| Compare: detached/overridden | Compare detached components or overridden instances against base component | P2 | [Compare changes in Dev Mode](https://help.figma.com/hc/en-us/articles/15023193382935-Compare-changes-in-Dev-Mode) |
| Compare: version timeline | Saved and autosaved versions list; only for top-level frames over time | P2 | [Compare changes in Dev Mode](https://help.figma.com/hc/en-us/articles/15023193382935-Compare-changes-in-Dev-Mode) |
| Compare: layer change labels | Edited, Added, Deleted per layer; clicking zooms to layer | P2 | [Compare changes in Dev Mode](https://help.figma.com/hc/en-us/articles/15023193382935-Compare-changes-in-Dev-Mode) |
| Compare: side by side | Two-up view with zoom in/out | P2 | [Compare changes in Dev Mode](https://help.figma.com/hc/en-us/articles/15023193382935-Compare-changes-in-Dev-Mode) |
| Compare: overlay | Current over previous with opacity slider and visibility toggle | P2 | [Compare changes in Dev Mode](https://help.figma.com/hc/en-us/articles/15023193382935-Compare-changes-in-Dev-Mode) |
| Compare: code diff | Code diff for edited layer with language and unit selectors | P2 | [Compare changes in Dev Mode](https://help.figma.com/hc/en-us/articles/15023193382935-Compare-changes-in-Dev-Mode) |
| Compare: properties diff | Previous vs current values for changed properties | P2 | [Compare changes in Dev Mode](https://help.figma.com/hc/en-us/articles/15023193382935-Compare-changes-in-Dev-Mode) |
| Compare: in focus view | Version ... > Compare to latest version | P2 | [Compare changes in Dev Mode](https://help.figma.com/hc/en-us/articles/15023193382935-Compare-changes-in-Dev-Mode) |

## Dev Mode: handoff statuses, notifications, and admin

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Dev status: Ready for dev | Mark sections, frames, components ready; button next to label (above components) | P1 | [Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications) |
| Dev status: Completed | Marks dev work done (Org/Enterprise) | P1 | [Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications) |
| Dev status: Changed state | Auto-set when ready/completed design is modified; not manually settable | P1 | [Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications) |
| Changed state: exclusions | Not triggered by library instance updates, variable/style value changes, temporary hover reflow | P1 | [Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications) |
| Dev status: Done with changes | Clears Changed; optional reason text added to history and notifications | P1 | [Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications) |
| Dev status: remove | Remove status from dropdown | P1 | [Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications) |
| Dev status: notes | Designers attach notes about updates to statuses | P1 | [Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications) |
| Dev notifications | Email, desktop, mobile push on ready/completed/updated; Slack and Teams integrations | Local: OS notifications on file watch | [Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications) |
| Dev notifications: grouping | Multiple status changes within an hour grouped by type | P2 | [Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications) |
| Dev notifications: links | Inspect in Dev Mode opens ready view; cards open focus view | P2 | [Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications) |
| Dev notifications: per-file setting | Comment mode > Settings: Status changes or Nothing | P2 | [Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications) |
| Dev Mode admin: pin plugins org-wide | Pinned plugins appear in every user's Inspect panel; added to approved list | Local: default plugin config file | [Manage Dev Mode settings for an organization](https://help.figma.com/hc/en-us/articles/22927410880535-Manage-Dev-Mode-settings-for-an-organization) |
| Dev Mode admin: default code language | Org default snippet language and unit; plugins can supply languages; users may override | Local: app preference | [Manage Dev Mode settings for an organization](https://help.figma.com/hc/en-us/articles/22927410880535-Manage-Dev-Mode-settings-for-an-organization) |
| Dev Mode admin: auto-run plugin | One plugin per org auto-runs on file open; not for codegen plugins | Local: startup plugin preference | [Manage Dev Mode settings for an organization](https://help.figma.com/hc/en-us/articles/22927410880535-Manage-Dev-Mode-settings-for-an-organization) |
| Dev Mode admin: scope | Settings apply to all org files except drafts; Enterprise only | Local: N/A, no orgs | [Manage Dev Mode settings for an organization](https://help.figma.com/hc/en-us/articles/22927410880535-Manage-Dev-Mode-settings-for-an-organization) |

## Code Connect, VS Code, and animation handoff

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Code Connect | Maps design library components to codebase components; feeds Dev Mode and MCP; Org/Enterprise | P2 | [Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) |
| Code Connect UI | In-app, language-agnostic mapping via GitHub repo or manual path + optional component name | P2 | [Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) |
| Code Connect UI: GitHub connection | Optional repo authorization; file owner or org admin; no GitHub Enterprise Server | Local: point at local repo folder | [Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) |
| Code Connect UI: one-to-many | One design component mapped to multiple frameworks (React, SwiftUI, Compose, Vue) independently | P2 | [Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) |
| Code Connect UI: custom instructions | Per-mapping instructions included in MCP output | P2 | [Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) |
| Code Connect UI: enhanced codegen previews | AI-generated example snippets from connected source shown in Dev Mode | P2 | [Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) |
| Code Connect UI: no Inspect snippets | UI mappings show file/component name only, not snippets | P2 | [Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) |
| Code Connect CLI | Terminal tool in repo publishes connections; property mappings and dynamic snippets replace autogen code | P2 | [Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) |
| Code Connect CLI: template files | Framework-agnostic template format; batch files; CI support; parsers deprecated | P2 | [Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) |
| Code Connect: CLI/UI coexistence | CLI connections visible in UI but editable only via CLI | P2 | [Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) |
| Code Connect CLI: data collected | Component paths, repo URL, .figma file code; publish/unpublish events | Local: N/A, nothing uploaded | [Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) |
| VS Code extension | Inspect designs inside VS Code; Marketplace install; sign-in required | P2 | [Figma for VS Code](https://help.figma.com/hc/en-us/articles/15023121296151-Figma-for-VS-Code) |
| VS Code: Open in VS Code | From Dev Mode inspect Options on top-level frame (CSS language required) | P2 | [Figma for VS Code](https://help.figma.com/hc/en-us/articles/15023121296151-Figma-for-VS-Code) |
| VS Code: file browsing | Frames grouped by section, status, page; grid, focus view, search and filter | P2 | [Figma for VS Code](https://help.figma.com/hc/en-us/articles/15023121296151-Figma-for-VS-Code) |
| VS Code: tabs | Layers (ready for dev), Code (snippets, modes, styles), Dev resources, Component, Assets | P2 | [Figma for VS Code](https://help.figma.com/hc/en-us/articles/15023121296151-Figma-for-VS-Code) |
| VS Code: dev resource local open | Links matching codebase open file in VS Code instead of browser | P2 | [Figma for VS Code](https://help.figma.com/hc/en-us/articles/15023121296151-Figma-for-VS-Code) |
| VS Code: autocomplete suggestions | Code completion based on selected layer | P2 | [Figma for VS Code](https://help.figma.com/hc/en-us/articles/15023121296151-Figma-for-VS-Code) |
| VS Code: comment notifications | Real-time comment notifications; view and reply in editor | P2 | [Figma for VS Code](https://help.figma.com/hc/en-us/articles/15023121296151-Figma-for-VS-Code) |
| VS Code: run plugins | Private plugins can run inside VS Code | P2 | [Figma for VS Code](https://help.figma.com/hc/en-us/articles/15023121296151-Figma-for-VS-Code) |
| VS Code: log out | Command palette > Figma: Log out | Local: N/A, no accounts | [Figma for VS Code](https://help.figma.com/hc/en-us/articles/15023121296151-Figma-for-VS-Code) |
| Motion handoff: Motion tab | Inspect panel Motion tab > Show in timeline view (read-only timeline with code) | Module | [Hand off animations to development](https://help.figma.com/hc/en-us/articles/41296356954263-Hand-off-animations-to-development) |
| Motion handoff: code export | Copy animation code as CSS (default), React, or JSON | Module | [Hand off animations to development](https://help.figma.com/hc/en-us/articles/41296356954263-Hand-off-animations-to-development) |
| Motion handoff: MCP context | MCP supplies keyframes, motion type, timing values, easing curves | Module | [Hand off animations to development](https://help.figma.com/hc/en-us/articles/41296356954263-Hand-off-animations-to-development) |

## Desktop app

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Desktop app: platforms | macOS 12+ (Intel, Apple Silicon); Windows 10+ 64-bit; Windows Arm build | P0 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Desktop app: feature parity | Same features as browser plus local fonts and plugin/widget development | P0 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Desktop app: local fonts | Uses fonts installed on device without separate installer | P0 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Font helper (FigmaAgent) | Background localhost HTTP/HTTPS server exposing installed fonts to browser; figma.com-only | Local: native font enumeration, no helper | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Desktop app: update prompts | In-app update message; old versions unsupported after 6 months | P1 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Desktop app: beta channel | Separate Figma Beta app installable side by side; bug fixes only | P2 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Desktop app: login methods | Email/password, Google SSO, SAML SSO | Local: N/A, no accounts | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Desktop app: file browser home | Opens to file browser of drafts, teams, resources | Local: recent files and folders on disk | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Desktop app: file tabs | Each file opens in a tab with file-type favicon; leading emoji in name used as tab icon | P0 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Tabs: pin/unpin | Right-click > Pin tab; pinned shows favicon only; hover for name | P1 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Tabs: close others/all | Close other tabs (incl. pinned), Close all tabs | P0 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Tabs: audio indicator and mute | Audio icon on tabs playing sound; click to mute that tab only | P2 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Tabs: tab menu | Overflow menu listing open and recently closed tabs across windows; reopen, close, mute | P1 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Tabs: reopen recently closed | Reopen recently closed tabs from tab menu | P1 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Tabs: show when presenting | View > Always Show Tabs When Presenting (Mac only) | P2 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Tab groups | Add to Tab Group; named, colored, collapsible groups; rename, recolor, ungroup, delete (closes tabs) | P2 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Split tab view | Two files (or same file twice, live-synced) side by side; drag tab to edge; resizable divider | P2 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Split tab view: exit | Right-click > Separate tabs or close one | P2 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Multiple windows | Drag tab out to new window; drag tabs between windows | P1 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Community nav keys | Arrow keys navigate back/forward in Community view | Local: N/A, no community | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Desktop notifications tray | Notifications in macOS menu bar / Windows system tray | Local: OS notifications only | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |
| Trackpad haptic feedback | Preferences toggle; haptics on prototype connections, FigJam emotes; macOS Force Touch | P2 | [Guide to the Figma desktop app](https://help.figma.com/hc/en-us/articles/5601429983767-Guide-to-the-Figma-desktop-app) |

## Mobile app

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Mobile app: platforms | iOS 16+, Android 8+, iPadOS; no OS betas | P2 | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile app: view-only design | Cannot edit Design files or Slides decks; view, comment, prototype | P2 | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: canvas navigation | Drag to pan, pinch to zoom, preview slider between frames, switch pages | P2 | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: share frame links | Copy and share links to specific frames | Local: N/A, no cloud links | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: export frames | Export frames to phone in various sizes and formats | P2 | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: comments | Long-press to comment; quick reply view; reactions; resolve; Activity tab | Local: N/A, no accounts | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: file browsing | Recents (Prototypes, Files), See all, Search tab, starred files; cannot star on mobile | P2 | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: multiple accounts | Sign into and switch between multiple accounts | Local: N/A, no accounts | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: favorites | Mark files and folders as favorites | P2 | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: prototype viewer | Tap to advance if no interactions; two-finger hold reveals hidden menu | P2 | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile prototype menu | Switch flow starts, restart, view file, comments toggle, hotspot hints, share, exit | P2 | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: mirror frames | Mirror tab shows desktop-selected frame live on device at device scale | P1 | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: Slides viewer | Slide previews strip, pinch zoom, comments, landscape full screen | Module | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: Make preview | Preview Make apps, share, comment; cannot create/edit | Module | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: FigJam on iPad | Edit boards with Apple Pencil drawing, shapes, connectors, washi tape, stickers, stamps, templates | Module | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| Mobile: push notifications | Enabled by default; configurable in Notifications settings | Local: N/A, no server push | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |
| UI languages | English, Japanese, Korean, French, German, Spanish (Spain, LatAm), Portuguese (Brazil) | P1 | [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app) |

## Cross-product and copy/paste

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Product family | Design, Dev Mode, FigJam, Slides, Draw, Make, Sites (beta), Buzz (beta) | Module | [What is Figma?](https://help.figma.com/hc/en-us/articles/14563969806359-What-is-Figma) |
| Figma Draw | Illustration tools in Design files: brushes, transforms, textures, improved vector editing | P1 | [What is Figma?](https://help.figma.com/hc/en-us/articles/14563969806359-What-is-Figma) |
| Cross-device copy/paste | Copy on iPad/desktop, paste banner on other device; same account; app 22.9+ | Local: N/A, no accounts | [Work between Figma and FigJam](https://help.figma.com/hc/en-us/articles/1500005916661-Work-between-Figma-and-FigJam) |
| FigJam to Design paste | Keeps color, format, size, layout; stamps become images; stickers/components become instances | Module | [Work between Figma and FigJam](https://help.figma.com/hc/en-us/articles/1500005916661-Work-between-Figma-and-FigJam) |
| FigJam marker paste | Marker strokes paste as editable vector paths with stroke properties | Module | [Work between Figma and FigJam](https://help.figma.com/hc/en-us/articles/1500005916661-Work-between-Figma-and-FigJam) |
| GIF paste behavior | GIFs from FigJam play in presentation view; GIFs copied from browser paste static | P1 | [Work between Figma and FigJam](https://help.figma.com/hc/en-us/articles/1500005916661-Work-between-Figma-and-FigJam) |
| Special objects in Design | Stickies, shapes with text, connectors, tables shown purple in Layers with type icons | Module | [Work between Figma and FigJam](https://help.figma.com/hc/en-us/articles/1500005916661-Work-between-Figma-and-FigJam) |
| Special objects: edit rules | Move/flip/rotate/restyle allowed; no child editing; not allowed in components | Module | [Work between Figma and FigJam](https://help.figma.com/hc/en-us/articles/1500005916661-Work-between-Figma-and-FigJam) |
| Design to FigJam paste | Frames, images, components, text, links paste; limited to FigJam styling; no conversion to connectors | Module | [Work between Figma and FigJam](https://help.figma.com/hc/en-us/articles/1500005916661-Work-between-Figma-and-FigJam) |
| Round-trip custom styling | Design edits to FigJam objects preserved when pasted back | Module | [Work between Figma and FigJam](https://help.figma.com/hc/en-us/articles/1500005916661-Work-between-Figma-and-FigJam) |
| Unpublished component paste to FigJam | Pastes as regular object, not instance | Module | [Work between Figma and FigJam](https://help.figma.com/hc/en-us/articles/1500005916661-Work-between-Figma-and-FigJam) |
| Shared libraries in FigJam | Design-created component libraries usable from FigJam | Module | [Work between Figma and FigJam](https://help.figma.com/hc/en-us/articles/1500005916661-Work-between-Figma-and-FigJam) |

## Spell check

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Spell check | Red squiggle on active text layer in edit mode; Design, FigJam, Slides | P0 | [Use spell check](https://help.figma.com/hc/en-us/articles/27323589692055-Use-spell-check) |
| Spell check: suggestions | Right-click for suggestions; Tab inserts first suggestion | P0 | [Use spell check](https://help.figma.com/hc/en-us/articles/27323589692055-Use-spell-check) |
| Spell check: languages | Desktop: any OS language; browser: English (US, CA, UK), Russian unless font installer present | P0 | [Use spell check](https://help.figma.com/hc/en-us/articles/27323589692055-Use-spell-check) |
| Spell check: language picker | Menu > Text > Spell check > language list | P0 | [Use spell check](https://help.figma.com/hc/en-us/articles/27323589692055-Use-spell-check) |
| Spell check: toggle | Menu > Text > Spell check > Check spelling; preference separate per web/desktop | P0 | [Use spell check](https://help.figma.com/hc/en-us/articles/27323589692055-Use-spell-check) |
| Spell check: personal dictionary | Add to dictionary; applies across all files; entries cannot be removed | P0 | [Use spell check](https://help.figma.com/hc/en-us/articles/27323589692055-Use-spell-check) |

## AI search, text, organization, and prototyping tools

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| AI search: Find similar designs | Search components and non-component designs by prompt, selection, or image | P2 | [Find assets and designs using AI](https://help.figma.com/hc/en-us/articles/24037716110615-Find-assets-and-designs-using-AI) |
| AI search: Find more like | Actions > Find more like on a selected layer | P2 | [Find assets and designs using AI](https://help.figma.com/hc/en-us/articles/24037716110615-Find-assets-and-designs-using-AI) |
| AI search: search with image | Image-fill layer or uploaded image as query | P2 | [Find assets and designs using AI](https://help.figma.com/hc/en-us/articles/24037716110615-Find-assets-and-designs-using-AI) |
| AI search: Figma/Community tabs | Results from accessible files or Community; library filter dropdown | P2 | [Find assets and designs using AI](https://help.figma.com/hc/en-us/articles/24037716110615-Find-assets-and-designs-using-AI) |
| AI search: filters and sort | Filter by file owner, space; sort by relevance, last modified | P2 | [Find assets and designs using AI](https://help.figma.com/hc/en-us/articles/24037716110615-Find-assets-and-designs-using-AI) |
| AI search: result actions | Open source file in new tab, preview in current tab, insert into file | P2 | [Find assets and designs using AI](https://help.figma.com/hc/en-us/articles/24037716110615-Find-assets-and-designs-using-AI) |
| Assets search: keyword | Non-AI matches exact name/description keywords | P0 | [Find assets and designs using AI](https://help.figma.com/hc/en-us/articles/24037716110615-Find-assets-and-designs-using-AI) |
| Assets search: semantic | AI matches related components by form or function | P2 | [Find assets and designs using AI](https://help.figma.com/hc/en-us/articles/24037716110615-Find-assets-and-designs-using-AI) |
| Rename layers with AI | Contextual names from content, location, relationships; right-click, Actions, or quick actions; free | P2 | [Rename layers with AI](https://help.figma.com/hc/en-us/articles/24004711129879-Rename-layers-with-AI) |
| AI rename: scope rules | Renames default-named frames, groups, image rects, text, instances; skips renamed, hidden, locked, nested-instance, vectors | P2 | [Rename layers with AI](https://help.figma.com/hc/en-us/articles/24004711129879-Rename-layers-with-AI) |
| AI rename: cross-frame matching | Same unnamed layer across top-level frames renamed identically to keep Smart animate working | P2 | [Rename layers with AI](https://help.figma.com/hc/en-us/articles/24004711129879-Rename-layers-with-AI) |
| AI rename: Rename anyway | "No layers need renaming" banner with override | P2 | [Rename layers with AI](https://help.figma.com/hc/en-us/articles/24004711129879-Rename-layers-with-AI) |
| Bulk rename with regex | Manual batch rename with regular expressions, prefix/suffix | P0 | [Rename layers with AI](https://help.figma.com/hc/en-us/articles/24004711129879-Rename-layers-with-AI) |
| Add interactions with AI | Prototype tab > Add interactions: auto-wires frame flows, back/next buttons, nav links; 20 credits | P2 | [Make interactions with AI](https://help.figma.com/hc/en-us/articles/24004778051479-Make-interactions-with-AI) |
| AI interactions: review | Banner to Preview in inline preview, Keep it to accept | P2 | [Make interactions with AI](https://help.figma.com/hc/en-us/articles/24004778051479-Make-interactions-with-AI) |
| Prototype: Remove all connections | Right-click canvas removes all connections on page | P1 | [Make interactions with AI](https://help.figma.com/hc/en-us/articles/24004778051479-Make-interactions-with-AI) |
| Prototype: Interaction details on canvas | Click connection opens Interaction details modal; Delete removes | P0 | [Make interactions with AI](https://help.figma.com/hc/en-us/articles/24004778051479-Make-interactions-with-AI) |
| Sort stickies | Organize > Sort stickies by Topic, Color, Author, Stamp count, Stamp type into new section copy | Module | [Sort and summarize stickies with FigJam AI](https://help.figma.com/hc/en-us/articles/18711926790423-Sort-and-summarize-stickies-with-FigJam-AI) |
| Summarize stickies | AI summary object from 2+ stickies; Copy text or Link; not editable | Module | [Sort and summarize stickies with FigJam AI](https://help.figma.com/hc/en-us/articles/18711926790423-Sort-and-summarize-stickies-with-FigJam-AI) |
| Rewrite this | Actions > Rewrite this: prompt-driven rewrite or generate copy | P2 | [Rewrite, translate, and shorten text with AI](https://help.figma.com/hc/en-us/articles/24004868368919-Rewrite-translate-and-shorten-text-with-AI) |
| Shorten text | Actions > Shorten condenses text layer | P2 | [Rewrite, translate, and shorten text with AI](https://help.figma.com/hc/en-us/articles/24004868368919-Rewrite-translate-and-shorten-text-with-AI) |
| Translate text | Actions > Translate to... language picker | P2 | [Rewrite, translate, and shorten text with AI](https://help.figma.com/hc/en-us/articles/24004868368919-Rewrite-translate-and-shorten-text-with-AI) |
| Adjust tone | Tone dial/axis with presets Executive, Technical, Basic, Educational; Try again, Reset (FigJam, Slides) | Module | [Adjust tone using Figma AI](https://help.figma.com/hc/en-us/articles/24244814883735-Adjust-tone-using-Figma-AI) |
| Replace content | AI fills realistic text across selected/duplicated items with optional prompt; no images | P2 | [Replace text content with AI](https://help.figma.com/hc/en-us/articles/23796390206743-Replace-text-content-with-AI) |
| Replace content: duplicate suggestion | Banner suggests Replace content after duplicating placeholder layers | P2 | [Replace text content with AI](https://help.figma.com/hc/en-us/articles/23796390206743-Replace-text-content-with-AI) |
| AI text suggestions (retired) | Inline ghost-text autocomplete of text strings; launched Config 2025, retired | P2 | [AI text suggestions (retired)](https://help.figma.com/hc/en-us/articles/31326388366871-AI-text-suggestions-retired) |
| Actions menu | Toolbar Actions hub for AI tools, search, First Draft, plugins | P1 | [Find assets and designs using AI](https://help.figma.com/hc/en-us/articles/24037716110615-Find-assets-and-designs-using-AI) |

## AI design and image generation

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| First Draft | Actions > First Draft: prompt to editable wireframe/design from Figma-built libraries; now via agent | P2 | [Use First Draft with Figma AI](https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI) |
| First Draft: library choice | Website or mobile app, wireframe or basic design; auto-picks if unset | P2 | [Use First Draft with Figma AI](https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI) |
| First Draft: theme previews | Thumbnail themes under prompt to preview alternatives | P2 | [Use First Draft with Figma AI](https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI) |
| First Draft: prompt edits | Change theme, content, structure; scope prompt to selected elements | P2 | [Use First Draft with Figma AI](https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI) |
| First Draft: style controls | Light/dark toggle, preset/custom color, border radius slider, spacing slider, title/body/label fonts | P2 | [Use First Draft with Figma AI](https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI) |
| First Draft: limits | Common web/app patterns only; no own design system; edits lost after closing Actions | P2 | [Use First Draft with Figma AI](https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI) |
| Make an image | Actions > Make an image: prompt, model choice, optional reference image (upload, paste, drag); fills layer or new | P2 | [Generate and edit images with Figma AI](https://help.figma.com/hc/en-us/articles/24004542669463-Generate-and-edit-images-with-Figma-AI) |
| Make an image: from fill | Available when adding an image fill | P2 | [Generate and edit images with Figma AI](https://help.figma.com/hc/en-us/articles/24004542669463-Generate-and-edit-images-with-Figma-AI) |
| Edit image with prompt | Secondary toolbar Edit with prompt; model choice and reference image | P2 | [Generate and edit images with Figma AI](https://help.figma.com/hc/en-us/articles/24004542669463-Generate-and-edit-images-with-Figma-AI) |
| Select area: erase | Lasso area of image and Erase | P2 | [Generate and edit images with Figma AI](https://help.figma.com/hc/en-us/articles/24004542669463-Generate-and-edit-images-with-Figma-AI) |
| Select area: isolate | Lasso area and Isolate into new image layer | P2 | [Generate and edit images with Figma AI](https://help.figma.com/hc/en-us/articles/24004542669463-Generate-and-edit-images-with-Figma-AI) |
| Remove background | One or more images; secondary toolbar | P2 | [Generate and edit images with Figma AI](https://help.figma.com/hc/en-us/articles/24004542669463-Generate-and-edit-images-with-Figma-AI) |
| Expand image | Drag handles or aspect ratio dropdown to outpaint beyond borders | P2 | [Generate and edit images with Figma AI](https://help.figma.com/hc/en-us/articles/24004542669463-Generate-and-edit-images-with-Figma-AI) |
| Boost resolution | AI upscale of low-res images | P2 | [Generate and edit images with Figma AI](https://help.figma.com/hc/en-us/articles/24004542669463-Generate-and-edit-images-with-Figma-AI) |
| AI image tasks: background run | Image tasks run concurrently while user continues designing elsewhere | P2 | [Generate and edit images with Figma AI](https://help.figma.com/hc/en-us/articles/24004542669463-Generate-and-edit-images-with-Figma-AI) |
| Vectorize image | Raster to editable vectors via More > Vectorize | P2 | [Convert static images to vector layers](https://help.figma.com/hc/en-us/articles/38031452710807-Convert-static-images-to-vector-layers) |
| Vectorize: recolor modes | Full color (number of colors), Grayscale (number of grays), Black and white (threshold) | P2 | [Convert static images to vector layers](https://help.figma.com/hc/en-us/articles/38031452710807-Convert-static-images-to-vector-layers) |
| Weave tools | Node-workflow AI image apps run from Tools tab (Weave filter); settings, run count, Generate | P2 | [Use Weave tools in Figma](https://help.figma.com/hc/en-us/articles/40779260614935-Use-Weave-tools-in-Figma) |
| Weave tools: built-in list | ~40 tools e.g. Generate mockup, Transfer style, Replace background, Change lighting, Sticker pack (18-110 credits) | P2 | [How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |
| Weave tools: community and remix | Community-published tools; Open in Weave to view, duplicate, republish workflow | P2 | [Use Weave tools in Figma](https://help.figma.com/hc/en-us/articles/40779260614935-Use-Weave-tools-in-Figma) |

## Figma agent and MCP connectors

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Figma agent | Conversational in-canvas AI: generates designs, edits, applies design system, gives feedback, busywork | P2 | [Get started with Figma AI](https://help.figma.com/hc/en-us/articles/24039793359767-Get-started-with-Figma-AI) |
| Agent: seat permissions | Full + edit can make edits; View/Dev/Collab or view-only can chat without editing | Local: N/A, no seats | [Get started with Figma AI](https://help.figma.com/hc/en-us/articles/24039793359767-Get-started-with-Figma-AI) |
| Agent: Agents panel | Left nav Agents panel listing chats per file | P2 | [Manage chat visibility for the Figma agent](https://help.figma.com/hc/en-us/articles/41272399602583-Manage-chat-visibility-for-the-Figma-agent) |
| Agent: parallel chats | Run multiple chats simultaneously | P2 | [Best practices for optimizing AI credits with the Figma agent](https://help.figma.com/hc/en-us/articles/43707097479575-Best-practices-for-optimizing-AI-credits-with-the-Figma-agent) |
| Agent: chat history as context | Full chat history carried forward; long chats cost more; start new chat per task | P2 | [Best practices for optimizing AI credits with the Figma agent](https://help.figma.com/hc/en-us/articles/43707097479575-Best-practices-for-optimizing-AI-credits-with-the-Figma-agent) |
| Agent: canvas selection context | Selected frames/layers sent as context | P2 | [Best practices for optimizing AI credits with the Figma agent](https://help.figma.com/hc/en-us/articles/43707097479575-Best-practices-for-optimizing-AI-credits-with-the-Figma-agent) |
| Agent chat visibility | Shared chat (file viewers can read, only creator continues) or Private chat; default shared since Jun 23 2026 | Local: chats saved in file or sidecar | [Manage chat visibility for the Figma agent](https://help.figma.com/hc/en-us/articles/41272399602583-Manage-chat-visibility-for-the-Figma-agent) |
| Agent chat: bulk make private | Make your existing chats private in one action | P2 | [Manage chat visibility for the Figma agent](https://help.figma.com/hc/en-us/articles/41272399602583-Manage-chat-visibility-for-the-Figma-agent) |
| Agent chat: copy link | Copy link to shared chat; private chats not linkable | P2 | [Manage chat visibility for the Figma agent](https://help.figma.com/hc/en-us/articles/41272399602583-Manage-chat-visibility-for-the-Figma-agent) |
| Agent attachments: types | Figma files (Design, FigJam, Slides), images, text, PDFs, pptx, xlsx; video/audio in Make only | P2 | [Attach files to a prompt in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-files-to-a-prompt-in-the-Figma-agent-and-Figma-Make) |
| Agent attachments: Figma files | Attach Figma files via link or file browser | P2 | [Attach files to a prompt in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-files-to-a-prompt-in-the-Figma-agent-and-Figma-Make) |
| Agent attachments: drag and drop | Drag files into prompt box | P2 | [Attach files to a prompt in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-files-to-a-prompt-in-the-Figma-agent-and-Figma-Make) |
| Agent attachments: images | JPEG, PNG, GIF, SVG (1MB); 50MB in agent; used as reference or embedded asset | P2 | [Attach files to a prompt in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-files-to-a-prompt-in-the-Figma-agent-and-Figma-Make) |
| Agent attachments: text/code | html, md, txt, docx, ts, js, tsx, jsx, css, scss, json, csv etc; 1MB max | P2 | [Attach files to a prompt in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-files-to-a-prompt-in-the-Figma-agent-and-Figma-Make) |
| Agent attachments: PDFs | Reference only (brand guides, PRDs); 5MB max | P2 | [Attach files to a prompt in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-files-to-a-prompt-in-the-Figma-agent-and-Figma-Make) |
| Agent attachments: pptx/xlsx | Presentations and spreadsheets; 20MB max | P2 | [Attach files to a prompt in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-files-to-a-prompt-in-the-Figma-agent-and-Figma-Make) |
| Agent attachments: limits | Agent: unlimited per chat; Make: 10 per prompt, 30 (Starter/Edu) or 500 per file | P2 | [Attach files to a prompt in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-files-to-a-prompt-in-the-Figma-agent-and-Figma-Make) |
| Make: Community attribution | Using Community designs generates Attributions.md packaged with app | Module | [Attach files to a prompt in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-files-to-a-prompt-in-the-Figma-agent-and-Figma-Make) |
| Make: video/audio attachments | mp4, webm, mp3, m4a up to 50MB; embed only, not analyzed | Module | [Attach files to a prompt in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-files-to-a-prompt-in-the-Figma-agent-and-Figma-Make) |
| Custom skills | Markdown files per Agent Skills spec; invoked with /slash name; available across all files | P2 | [Create and manage custom skills in Figma](https://help.figma.com/hc/en-us/articles/40283639496599-Create-and-manage-custom-skills-in-Figma) |
| Custom skills: create | Prompt agent to write/merge/revise, upload single .md, or Start from scratch (name, description, instructions) | P2 | [Create and manage custom skills in Figma](https://help.figma.com/hc/en-us/articles/40283639496599-Create-and-manage-custom-skills-in-Figma) |
| Custom skills: limits | No scripts/, references/, assets/ dirs; only first of multiple mentioned skills invoked | P2 | [Create and manage custom skills in Figma](https://help.figma.com/hc/en-us/articles/40283639496599-Create-and-manage-custom-skills-in-Figma) |
| Custom skills: manage | Edit, export as .md, enable/disable toggle, delete (permanent) via Manage skills | P2 | [Create and manage custom skills in Figma](https://help.figma.com/hc/en-us/articles/40283639496599-Create-and-manage-custom-skills-in-Figma) |
| Custom skills: publish | Publish privately to team/org or to Community (thumbnail + 9 images 1920x1080, tagline, category) | Local: share .md files in folder | [Create and manage custom skills in Figma](https://help.figma.com/hc/en-us/articles/40283639496599-Create-and-manage-custom-skills-in-Figma) |
| Custom skills: update/unpublish | Publish changes; unpublish keeps personal copy | Local: N/A, no community | [Create and manage custom skills in Figma](https://help.figma.com/hc/en-us/articles/40283639496599-Create-and-manage-custom-skills-in-Figma) |
| Custom MCP connectors | Connect agent/Make to any remote HTTPS MCP server for external context | P2 | [Create and use custom MCP connectors in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/38147204302743-Create-and-use-custom-MCP-connectors-in-the-Figma-agent-and-Figma-Make) |
| Custom connector: create | Name, optional icon/tagline/description, server URL, Advanced auth settings; creator-only unless admin publishes | P2 | [Create and use custom MCP connectors in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/38147204302743-Create-and-use-custom-MCP-connectors-in-the-Figma-agent-and-Figma-Make) |
| Custom connector: auth methods | OAuth 2.0 (default), OAuth client credentials, custom request headers (API keys), none | P2 | [Create and use custom MCP connectors in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/38147204302743-Create-and-use-custom-MCP-connectors-in-the-Figma-agent-and-Figma-Make) |
| Custom connector: tool permissions | Per tool: Ask to run, Always run, Never run; write tools off by default | P2 | [Create and use custom MCP connectors in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/38147204302743-Create-and-use-custom-MCP-connectors-in-the-Figma-agent-and-Figma-Make) |
| Custom connector: @mention | Type @ to pin connector to message; agent asks consent with Run button | P2 | [Create and use custom MCP connectors in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/38147204302743-Create-and-use-custom-MCP-connectors-in-the-Figma-agent-and-Figma-Make) |
| Custom connector: disconnect/delete | Disconnect keeps config; delete removes; edit name, icon, headers | P2 | [Create and use custom MCP connectors in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/38147204302743-Create-and-use-custom-MCP-connectors-in-the-Figma-agent-and-Figma-Make) |
| Custom connector: no localhost/stdio | Only public HTTPS servers supported | Local: support localhost and stdio MCP | [Create and use custom MCP connectors in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/38147204302743-Create-and-use-custom-MCP-connectors-in-the-Figma-agent-and-Figma-Make) |
| Custom connector: admin publish/disable | Org/Ent admins publish connectors (with headers) or disable feature | Local: N/A, no admins | [Create and use custom MCP connectors in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/38147204302743-Create-and-use-custom-MCP-connectors-in-the-Figma-agent-and-Figma-Make) |
| Agent web search | Web search with automatic citations; web fetch retrieves a URL's content | P2 | [Search the web with the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/39715554287255-Search-the-web-with-the-Figma-agent-and-Figma-Make) |
| Agent web search: toggle | Off by default in Design (+ > Web search), on in Make; persists across chats | P2 | [Search the web with the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/39715554287255-Search-the-web-with-the-Figma-agent-and-Figma-Make) |
| Agent web search: limits | Public pages only; anti-scraping sites fail; admin can disable | P2 | [Search the web with the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/39715554287255-Search-the-web-with-the-Figma-agent-and-Figma-Make) |
| Agent: credit-saving practices | Scoped first prompt, minimal context, new chat per task, skills, generative plugins | P2 | [Best practices for optimizing AI credits with the Figma agent](https://help.figma.com/hc/en-us/articles/43707097479575-Best-practices-for-optimizing-AI-credits-with-the-Figma-agent) |
| Fig support chatbot | Free product-help chatbot via ? icon > Contact support | Local: offline help docs | [Best practices for optimizing AI credits with the Figma agent](https://help.figma.com/hc/en-us/articles/43707097479575-Best-practices-for-optimizing-AI-credits-with-the-Figma-agent) |
| Partner MCP connectors | Agent/Make act as MCP client to vetted servers; per-user OAuth; admin can disable | P2 | [Use verified partner MCP connectors with the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/35440096186007-Use-verified-partner-MCP-connectors-with-the-Figma-agent-and-Figma-Make) |
| Partner connectors: list | Amplitude, Asana, Askable, Atlassian, Box, Contentsquare, Dovetail, Granola, GitHub, Hex, Linear, Mapbox, Marvin, Mobbin, monday.com, Notion, Slack, Sprig, Twilio, Zapier, zeroheight | P2 | [Use verified partner MCP connectors with the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/35440096186007-Use-verified-partner-MCP-connectors-with-the-Figma-agent-and-Figma-Make) |
| Partner connectors: write-back | Write tools (e.g. create Jira/Linear issues, Notion docs) disabled by default | P2 | [Use verified partner MCP connectors with the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/35440096186007-Use-verified-partner-MCP-connectors-with-the-Figma-agent-and-Figma-Make) |
| Partner connectors: refresh context | Re-run connector to pull updated source content | P2 | [Use verified partner MCP connectors with the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/35440096186007-Use-verified-partner-MCP-connectors-with-the-Figma-agent-and-Figma-Make) |
| Partner connectors: per-chat disable | Temporarily disable connectors for current conversation | P2 | [Use verified partner MCP connectors with the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/35440096186007-Use-verified-partner-MCP-connectors-with-the-Figma-agent-and-Figma-Make) |
| Connectors: prompt-injection warning | UI cautions against injection from external sources | P2 | [Use verified partner MCP connectors with the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/35440096186007-Use-verified-partner-MCP-connectors-with-the-Figma-agent-and-Figma-Make) |

## Generative plugins and shaders

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Generative plugins | Agent writes Plugin API code from prompt ("Build me a plugin"); also for Draw and Motion | P2 | [Generate plugins with the Figma agent](https://help.figma.com/hc/en-us/articles/43028920030743-Generate-plugins-with-the-Figma-agent) |
| Generative plugin types | Content creators, layer modifiers, file utilities (batch rename, organize, broken flow checks) | P2 | [Generate plugins with the Figma agent](https://help.figma.com/hc/en-us/articles/43028920030743-Generate-plugins-with-the-Figma-agent) |
| Figma-built plugins/shaders | Free first-party plugins and shaders in Tools tab, Source: From Figma | P2 | [Generate plugins with the Figma agent](https://help.figma.com/hc/en-us/articles/43028920030743-Generate-plugins-with-the-Figma-agent) |
| Generative plugins: cost | Building/editing consumes AI credits; running is free | Local: N/A, BYO model key | [Generate plugins with the Figma agent](https://help.figma.com/hc/en-us/articles/43028920030743-Generate-plugins-with-the-Figma-agent) |
| Generative plugins: no monetization | Cannot sell generative plugins or shaders | Local: N/A, no marketplace | [Generate plugins with the Figma agent](https://help.figma.com/hc/en-us/articles/43028920030743-Generate-plugins-with-the-Figma-agent) |
| Tools tab | Left nav Tools tab lists plugins/shaders; search; Source filter (From Figma, Created by you); type/price filter | P2 | [Manage generative plugins as a creator](https://help.figma.com/hc/en-us/articles/43029048128023-Manage-generative-plugins-as-a-creator) |
| Generative tool: edit by prompt | Describe edits in Tools panel to modify plugin/shader | P2 | [Manage generative plugins as a creator](https://help.figma.com/hc/en-us/articles/43029048128023-Manage-generative-plugins-as-a-creator) |
| Generative tool: rename | Tools tab > ... > Rename | P2 | [Manage generative plugins as a creator](https://help.figma.com/hc/en-us/articles/43029048128023-Manage-generative-plugins-as-a-creator) |
| Generative tool: publish/update | Publish to Community or privately to org; Publish changes; cancel review | Local: share plugin folders | [Manage generative plugins as a creator](https://help.figma.com/hc/en-us/articles/43029048128023-Manage-generative-plugins-as-a-creator) |
| Generative tool: unpublish/delete | Unpublish removes for installers; must unpublish before delete; delete irreversible | Local: N/A, no community | [Manage generative plugins as a creator](https://help.figma.com/hc/en-us/articles/43029048128023-Manage-generative-plugins-as-a-creator) |
| Shader management | Find via Tools (Created by you, Shader effect/fill filter); edit by prompt, rename, publish, cancel review, delete | P2 | [Manage shaders as a creator](https://help.figma.com/hc/en-us/articles/43029079744151-Manage-shaders-as-a-creator) |
| Shaders | WebGPU-rendered agent-built shader fills and effects; open beta | P2 | [Create shaders with the Figma agent](https://help.figma.com/hc/en-us/articles/41147702210071-Create-shaders-with-the-Figma-agent) |
| Shader fills | Procedural patterns, gradients, textures (marble, fire, water), static or animated; on Fill and Stroke | P2 | [Create shaders with the Figma agent](https://help.figma.com/hc/en-us/articles/41147702210071-Create-shaders-with-the-Figma-agent) |
| Shader effects | Blur, distortion, grain, pixelation, dithering, color adjust; hover-triggered animation; in Effects section | P2 | [Create shaders with the Figma agent](https://help.figma.com/hc/en-us/articles/41147702210071-Create-shaders-with-the-Figma-agent) |
| Shaders: play control | Play button above layer runs animated/interactive shader; one running per page | P2 | [Create shaders with the Figma agent](https://help.figma.com/hc/en-us/articles/41147702210071-Create-shaders-with-the-Figma-agent) |
| Shaders: styles | Shader fills/effects saved as styles, stackable, publishable to libraries | P2 | [Create shaders with the Figma agent](https://help.figma.com/hc/en-us/articles/41147702210071-Create-shaders-with-the-Figma-agent) |
| Shaders: motion keyframes | Shader params keyframed in Motion timeline; export mp4, webp, gif | Module | [Create shaders with the Figma agent](https://help.figma.com/hc/en-us/articles/41147702210071-Create-shaders-with-the-Figma-agent) |
| Shaders: export to Make via MCP | Exported instances not linked to original shader | Module | [Create shaders with the Figma agent](https://help.figma.com/hc/en-us/articles/41147702210071-Create-shaders-with-the-Figma-agent) |
| Shaders: requirements | WebGPU support needed in system and browser | P2 | [Create shaders with the Figma agent](https://help.figma.com/hc/en-us/articles/41147702210071-Create-shaders-with-the-Figma-agent) |
| Generative controls (PropsKit) | Color picker, slider, toggle, dropdown, number input, on-canvas handle; playground with Copy prompt | P2 | [PropsKit component playground](https://help.figma.com/hc/en-us/articles/41306719221143-PropsKit-component-playground) |
| Prompting guidance: plugins/shaders | Trigger words, describe outcomes, real-world analogies, preserve properties, controls | P2 | [Prompting tips for generative plugins and shaders](https://help.figma.com/hc/en-us/articles/41408020198935-Prompting-tips-for-generative-plugins-and-shaders) |
| Shader prompting: preserve properties | Specify legibility, shape, color, transparency, brand constraints to keep | P2 | [Prompting tips for generative plugins and shaders](https://help.figma.com/hc/en-us/articles/41408020198935-Prompting-tips-for-generative-plugins-and-shaders) |
| Image-to-description | Ask agent to describe a reference image's visual effect for prompting | P2 | [Prompting tips for generative plugins and shaders](https://help.figma.com/hc/en-us/articles/41408020198935-Prompting-tips-for-generative-plugins-and-shaders) |

## FigJam/Slides AI and third-party AI integrations

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Make templates and diagrams | Actions > Make templates and diagrams: boards, mind maps, flow charts, timelines, Gantt, org charts; 2-24 credits | Module | [Make boards and diagrams with FigJam AI](https://help.figma.com/hc/en-us/articles/18706554628119-Make-boards-and-diagrams-with-FigJam-AI) |
| FigJam AI: suggested templates | Suggested templates (retrospective, 1:1) and add-on sections (Next steps, agenda, calendar) | Module | [Make boards and diagrams with FigJam AI](https://help.figma.com/hc/en-us/articles/18706554628119-Make-boards-and-diagrams-with-FigJam-AI) |
| Deck from FigJam board | AI summarizes board (page or all pages) into Slides deck with optional template | Module | [Generate a slide deck from a FigJam board using Figma AI](https://help.figma.com/hc/en-us/articles/25968453273495-Generate-a-slide-deck-from-a-FigJam-board-using-Figma-AI) |
| Deck from board: entry points | Slides: New slide > Make Slides with an outline; FigJam: File menu, page menu, Share, sticky right-click | Module | [Generate a slide deck from a FigJam board using Figma AI](https://help.figma.com/hc/en-us/articles/25968453273495-Generate-a-slide-deck-from-a-FigJam-board-using-Figma-AI) |
| Jambot widget | ChatGPT-powered FigJam widget; input sticky or connector-linked stickies/sections | Module | [Use Jambot in FigJam](https://help.figma.com/hc/en-us/articles/16783866441111-Use-Jambot-in-FigJam) |
| Jambot functions | Ideate, Quick question, Teach me, Give me, Rabbit hole, Similar stuff, Summarize, Rewrite, Turn into, Code this up, Custom | Module | [Use Jambot in FigJam](https://help.figma.com/hc/en-us/articles/16783866441111-Use-Jambot-in-FigJam) |
| Generated tool code viewer | Tools > ... > View code; any shader, own plugins only; copy or Download all files | P2 | [View code for generated plugins and shaders](https://help.figma.com/hc/en-us/articles/43029371170071-View-code-for-generated-plugins-and-shaders) |
| Generated tool code edit | Change code by prompting agent or via MCP | P2 | [View code for generated plugins and shaders](https://help.figma.com/hc/en-us/articles/43029371170071-View-code-for-generated-plugins-and-shaders) |
| Claude connector diagrams | Claude creates FigJam flowcharts, decision trees, Gantt, sequence, state diagrams with inline preview | Module | [Create FigJam diagrams with Claude](https://help.figma.com/hc/en-us/articles/37883260397975-Create-FigJam-diagrams-with-Claude) |
| Claude: embedded preview | Pan, zoom, full screen; Edit in Figma to claim | Module | [Create FigJam diagrams with Claude](https://help.figma.com/hc/en-us/articles/37883260397975-Create-FigJam-diagrams-with-Claude) |
| Unclaimed generated files | Files from Claude/Slackbot public by link until claimed into drafts | Local: N/A, files local | [Create FigJam diagrams with Claude](https://help.figma.com/hc/en-us/articles/37883260397975-Create-FigJam-diagrams-with-Claude) |
| Slackbot diagrams | @Figma in Slackbot creates FigJam diagrams from messages, threads, channels, canvases | Module | [Create FigJam diagrams with Slackbot](https://help.figma.com/hc/en-us/articles/41842203241623-Create-FigJam-diagrams-with-Slackbot) |
| Slack app notifications | Mentions, comment replies, subscribed comments, invites, seat requests; real-time or hourly/daily digest | Local: N/A, no cloud events | [Create FigJam diagrams with Slackbot](https://help.figma.com/hc/en-us/articles/41842203241623-Create-FigJam-diagrams-with-Slackbot) |
| Slack: reply to comments | Reply to Figma comments from Slack; channel subscriptions | Local: N/A, no cloud events | [Create FigJam diagrams with Slackbot](https://help.figma.com/hc/en-us/articles/41842203241623-Create-FigJam-diagrams-with-Slackbot) |
| ChatGPT app | Create FigJam diagrams and Slides decks from ChatGPT (not in EU); embedded preview; Slides beta | Module | [Use ChatGPT with Figma](https://help.figma.com/hc/en-us/articles/35326636109975-Use-ChatGPT-with-Figma) |
| ChatGPT: Slides generation | Prompt converted to objective, outline, style notes; 28-72+ credits per deck | Module | [Use ChatGPT with Figma](https://help.figma.com/hc/en-us/articles/35326636109975-Use-ChatGPT-with-Figma) |
| Microsoft Copilot app | @Figma in Copilot generates FigJam flowcharts, Gantt, sequence, state diagrams from prompts/docs | Module | [Use FigJam with Microsoft Copilot](https://help.figma.com/hc/en-us/articles/39230335861911-Use-FigJam-with-Microsoft-Copilot) |
| Notion Custom Agents | Generate FigJam diagrams from Notion pages/databases; convert boards into Notion docs/tasks | Module | [Use Figma with Notion Custom Agents](https://help.figma.com/hc/en-us/articles/38586869551255-Use-Figma-with-Notion-Custom-Agents) |

## Figma AI: access, credits, and admin

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| AI entry points | Figma agent (chat), Figma Make (prompt-to-app), individual single-purpose AI tools | P2 | [Get started with Figma AI](https://help.figma.com/hc/en-us/articles/24039793359767-Get-started-with-Figma-AI) |
| AI tool matrix by product | Rewrite, translate, shorten, tone, make/edit image, remove bg, expand, isolate/erase, vectorize, boost, replace content, rename layers, interactions, search, diagrams, stickies, Jambot, deck from board, presenter notes | P2 | [Get started with Figma AI](https://help.figma.com/hc/en-us/articles/24039793359767-Get-started-with-Figma-AI) |
| AI: drafts trial | All seat types can try AI tools in drafts | Local: N/A, no seats | [Get started with Figma AI](https://help.figma.com/hc/en-us/articles/24039793359767-Get-started-with-Figma-AI) |
| AI: availability reasons | Admin opt-out, K-12 Education excluded, Government gets Make only | Local: user toggles AI, BYO key | [Get started with Figma AI](https://help.figma.com/hc/en-us/articles/24039793359767-Get-started-with-Figma-AI) |
| AI: output disclosure | Some features (e.g. summarize stickies) label output as AI-generated | P2 | [Get started with Figma AI](https://help.figma.com/hc/en-us/articles/24039793359767-Get-started-with-Figma-AI) |
| AI credits: seat allocation | Full: 500 Starter / 3,000 Pro / 3,500 Org / 4,250 Ent monthly; others 500 | Local: N/A, BYO model key | [How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |
| AI credits: daily cap | Starter and View seats limited to 150 credits/day | Local: N/A, BYO model key | [How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |
| AI credits: rules | Per user, monthly reset, no rollover, non-transferable, not stacked across plans, undo does not refund | Local: N/A, BYO model key | [How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |
| AI credits: per-feature costs | Search, rename, stickies free; remove bg 1-5; vectorize 2-5; boost/erase/isolate/expand 5-10; interactions 20 | Local: show token/cost estimate per action | [How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |
| AI credits: image model choice | Make/Edit image: ChatGPT Images 2.0 (2), Nano Banana 2 Lite (6), Nano Banana (8), Nano Banana 2 (16) | P2 | [How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |
| AI credits: agentic variable cost | Agent/Make cost varies by model, task complexity, context (files, libraries, connectors, history) | Local: show token usage per prompt | [How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |
| AI credits: post-run cost display | Hover AI credits icon under completed prompt to see consumption | P2 | [How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |
| AI balance menu | Main menu > AI balance: used, remaining, reset date, promo expiry | Local: usage meter for BYO key | [How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |
| AI credits: out-of-credits request | Blocked users can request more; admin notified by email and in product | Local: N/A, no admins | [How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |
| AI credits: error fixes free | Auto fix / Fix for me consume no extra credits | Local: N/A, BYO model key | [How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |
| AI credits: add-on purchase | Monthly subscription pool and/or pay-as-you-go with monthly spend limit; order seat > subscription > PAYG | Local: N/A, no billing | [Manage AI credits](https://help.figma.com/hc/en-us/articles/35865276858647-Manage-AI-credits) |
| AI credits: subscription terms | Pro month-to-month prorated; Org/Ent annual, downgrade only in 30-day renewal window | Local: N/A, no billing | [Manage AI credits](https://help.figma.com/hc/en-us/articles/35865276858647-Manage-AI-credits) |
| AI credits: PAYG limit changes | Immediate effect; lowering below accrued stops usage; accrued still billed | Local: N/A, no billing | [Manage AI credits](https://help.figma.com/hc/en-us/articles/35865276858647-Manage-AI-credits) |
| AI credits dashboard | Admin view: people using AI, at limit, days to reset, paid usage; filter by seat or billing group | Local: N/A, no admins | [Manage AI credits](https://help.figma.com/hc/en-us/articles/35865276858647-Manage-AI-credits) |
| AI credits: historic usage and CSV | Org/Ent past periods (since Nov 2025), last activity; CSV export of all data | Local: N/A, no admins | [Manage AI credits](https://help.figma.com/hc/en-us/articles/35865276858647-Manage-AI-credits) |
| AI credits: per-user usage | Admin > People > person side panel AI usage | Local: N/A, no admins | [Manage AI credits](https://help.figma.com/hc/en-us/articles/35865276858647-Manage-AI-credits) |
| AI credits: beta usage CSV | Org/Ent CSV of beta usage by product, emailed | Local: N/A, no admins | [Manage AI credits](https://help.figma.com/hc/en-us/articles/35865276858647-Manage-AI-credits) |
| AI Usage API | Enterprise REST API: per-user, per-day usage up to 1 year, by workspace/team/billing group | Local: N/A, no admins | [Manage AI credits](https://help.figma.com/hc/en-us/articles/35865276858647-Manage-AI-credits) |
| AI credits: billing groups | Enterprise: set aside paid credits per billing group via slider; bulk assign; remaining pool shared | Local: N/A, no billing | [Manage AI credits for billing groups](https://help.figma.com/hc/en-us/articles/39663732696087-Manage-AI-credits-for-billing-groups) |
| Billing group credits: rules | Max = total paid incl. PAYG; overcommit allowed; slight overage deducted from plan; per-user limit applies independently | Local: N/A, no billing | [Manage AI credits for billing groups](https://help.figma.com/hc/en-us/articles/39663732696087-Manage-AI-credits-for-billing-groups) |
| AI credits: Education plan | 3,000 per person monthly; no purchase; upgrade to Pro for more | Local: N/A, no billing | [AI credits on the Education plan](https://help.figma.com/hc/en-us/articles/37611757713431-AI-credits-on-the-Education-plan) |
| AI credits: GA changes | Agent in Design and Weave tools GA Oct 6 2026; add-ons 2x (Pro) / 1.6x (Org/Ent) credits | Local: N/A, no billing | [AI credit updates FAQ](https://help.figma.com/hc/en-us/articles/42614902212887-AI-credit-updates-FAQ) |
| AI promo codes | figma.com/promo/ai/<code>; user-level expiring credits used first; errors if expired/used/AI disabled | Local: N/A, no billing | [Redeem AI promo codes](https://help.figma.com/hc/en-us/articles/38834877344663-Redeem-AI-promo-codes) |
| AI settings: enable AI | Admin toggle per team/org; Enterprise per workspace overriding org default; permanent on Starter/Pro | Local: global AI on/off preference | [Manage AI settings and content training for your team or organization](https://help.figma.com/hc/en-us/articles/17725942479127-Manage-AI-settings-and-content-training-for-your-team-or-organization) |
| AI settings: content training | Admin toggle; default on Starter/Pro, off and locked on Org/Ent; Education/Government never trained | Local: N/A, no data leaves device | [Manage AI settings and content training for your team or organization](https://help.figma.com/hc/en-us/articles/17725942479127-Manage-AI-settings-and-content-training-for-your-team-or-organization) |
| AI data handling | Encryption at rest/transit; vendors (e.g. OpenAI) barred from training; limited retention; de-identification | Local: BYO provider, local models option | [Manage AI settings and content training for your team or organization](https://help.figma.com/hc/en-us/articles/17725942479127-Manage-AI-settings-and-content-training-for-your-team-or-organization) |
| AI credit limits per user | Full access, Custom monthly limit (slider), or No access; bulk change via People tab | Local: N/A, no admins | [Set AI credit limits](https://help.figma.com/hc/en-us/articles/41944442159767-Set-AI-credit-limits) |
| AI credit limits: precedence | User, billing group, and plan limits apply independently; first exhausted blocks | Local: N/A, no admins | [Set AI credit limits](https://help.figma.com/hc/en-us/articles/41944442159767-Set-AI-credit-limits) |
| AI credit limits: Request more | "Out of AI credits" message with Request more button notifying admin | Local: N/A, no admins | [Set AI credit limits](https://help.figma.com/hc/en-us/articles/41944442159767-Set-AI-credit-limits) |
| AI copyright protection | Indemnity for AI outputs for Org/Enterprise at no cost via sales/support | Local: N/A, legal not software | [Request AI copyright protection for your organization](https://help.figma.com/hc/en-us/articles/33558931634199-Request-AI-copyright-protection-for-your-organization) |

## Notes
- Dev Mode is a whole second workspace: inspect panel, code snippets (CSS/SwiftUI/UIKit/Compose/XML with px/rem/pt/dp/sp and unit scale), variables tooling, ready-for-dev/focus views, compare changes with overlay and code diff. A local-first app can ship most of it as a "Handoff" mode with no cloud needed. Statuses can live in the file; notifications become local file-watch events.
- Compare changes and the focus-view history depend on per-frame version history. Illigma needs a local version store (e.g. snapshots or a git-like history inside the file) before compare, overlay, and code-diff are possible.
- Figma's MCP server comes in two forms: remote (mcp.figma.com) and desktop (127.0.0.1:3845). use_figma runs Plugin API code, with a 20kb response limit per call and no image support. A bundled local MCP server that runs the same Plugin API would be a strong differentiator for Illigma, since it needs no auth and has no rate limits. Figma's own agent cannot reach localhost or stdio MCP servers.
- Plugin API compatibility is the biggest leverage point: classic plugins, widgets, codegen and Inspect plugins, generative plugins, shaders, MCP writes, and annotation automation all build on it. Plugin manifests are already stored locally on disk.
- Shaders need WebGPU. Only one animated shader can run per page. Shaders are stackable as styles and can be keyframed in Motion. Needs GPU capability detection and a fallback.
- Code Connect has two paths. The CLI uses template files kept in the repo, which fits local-first well. The UI path has GitHub mapping, one-to-many framework links, and custom instructions. Both feed Dev Mode snippets and MCP context.
- Desktop-app tab features (pinning, groups, split view of the same file with live sync, multiple windows, reopen closed tabs, audio mute) set the bar for a native shell. Figma supports macOS 12+ and Windows 10+ 64-bit, including Arm builds.
- Spell check: the desktop app uses OS dictionaries. The browser build is limited to English and Russian without the font helper. The personal dictionary is append-only. All of this maps directly to a native app.
- AI is extensive: an agent with skills and MCP connectors, image tools (generate, edit, erase, isolate, expand, upscale, remove background, vectorize), text tools, Weave tools, First Draft, AI interactions, and AI rename. The local equivalent is bring-your-own model key or local models, with per-action cost and token display in place of Figma's credit system.
- Cross-product paste rules (FigJam stickies, connectors, and tables become "special objects" in Design, and stamps become images) only matter once Illigma's whiteboard module exists. The file format should reserve these node types now.
