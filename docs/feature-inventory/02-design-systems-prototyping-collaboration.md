# Figma Design — design systems, prototyping, collaboration

## Components: create and manage

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Create component | Wrap selected layers in a component frame; sidebar button, right-click, Opt+Cmd+K / Ctrl+Alt+K | P0 | [Create components to reuse in designs](https://help.figma.com/hc/en-us/articles/360038663154-Create-components-to-reuse-in-designs) |
| Component layer icon | Components marked with purple component icon in Layers panel; instances distinct icon | P0 | [Create components to reuse in designs](https://help.figma.com/hc/en-us/articles/360038663154-Create-components-to-reuse-in-designs) |
| Create multiple components (bulk) | One component per selected frame, group, boolean, or path via Create component options menu | P0 | [Create components to reuse in designs](https://help.figma.com/hc/en-us/articles/360038663154-Create-components-to-reuse-in-designs) |
| Delete main component | Deleting main component leaves existing instances intact | P0 | [Create components to reuse in designs](https://help.figma.com/hc/en-us/articles/360038663154-Create-components-to-reuse-in-designs) |
| Restore main component | Restore deleted main from an instance (sidebar or right-click > Main component > Restore) | P0 | [Create components to reuse in designs](https://help.figma.com/hc/en-us/articles/360038663154-Create-components-to-reuse-in-designs) |
| Restore component from other file | "Go to main component in library" then Restore dialog when main lives in another file | P1 | [Create components to reuse in designs](https://help.figma.com/hc/en-us/articles/360038663154-Create-components-to-reuse-in-designs) |
| Component configuration: description + doc link | Add description and documentation link to component for consumers | P0 | [Create components to reuse in designs](https://help.figma.com/hc/en-us/articles/360038663154-Create-components-to-reuse-in-designs) |
| Animated components | Turn Motion timeline animations into components; instances shown as purple tracks on timeline | Module | [Create and use animated components](https://help.figma.com/hc/en-us/articles/41307940738967-Create-and-use-animated-components) |
| Animated instance: timeline repositioning | Drag instance track on timeline; duration/properties only editable on main | Module | [Create and use animated components](https://help.figma.com/hc/en-us/articles/41307940738967-Create-and-use-animated-components) |
| Components only in Design mode | Components created only in Design toggle; properties not editable inside Motion | Module | [Create and use animated components](https://help.figma.com/hc/en-us/articles/41307940738967-Create-and-use-animated-components) |
| Main component / instance model | Main defines component; linked instances receive its updates | P0 | [Guide to components in Figma](https://help.figma.com/hc/en-us/articles/360038662654-Guide-to-components-in-Figma) |
| Live propagation in same file | Edits to main apply immediately to instances in same file | P0 | [Edit main components](https://help.figma.com/hc/en-us/articles/360038665934-Edit-main-components) |
| Main editable only in source file | Main component only editable in the file where it lives | P0 | [Edit main components](https://help.figma.com/hc/en-us/articles/360038665934-Edit-main-components) |
| Go to main component | Ctrl+Opt+Cmd+K / Ctrl+Alt+Shift+K or instance menu; opens library file at main | P0 | [Edit main components](https://help.figma.com/hc/en-us/articles/360038665934-Edit-main-components) |
| Return to instance | After jumping to main in another file, button returns to originating instance | P1 | [Edit main components](https://help.figma.com/hc/en-us/articles/360038665934-Edit-main-components) |
| Push overrides to main component | Apply instance overrides to main (same file only, not nested instances) | P1 | [Edit main components](https://help.figma.com/hc/en-us/articles/360038665934-Edit-main-components) |
| Slash naming hierarchy | "/" in component names creates folder levels in Assets and swap menu | P0 | [Name and organize components](https://help.figma.com/hc/en-us/articles/360038663994-Name-and-organize-components) |
| Assets organized by file > page > frame/section | Library assets mirror file structure; pages listed alphanumerically | P0 | [Name and organize components](https://help.figma.com/hc/en-us/articles/360038663994-Name-and-organize-components) |
| Asset detail fly-out | Clicking component in Assets shows fly-out with description and properties | P1 | [Name and organize components](https://help.figma.com/hc/en-us/articles/360038663994-Name-and-organize-components) |
| Related components in swap menu | Related = same name path prefix or same frame/section in source file | P0 | [Name and organize components](https://help.figma.com/hc/en-us/articles/360038663994-Name-and-organize-components) |

## Variants and component sets

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Component set | Container grouping variant components; only components allowed inside (no text, frames, groups) | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Combine as variants | Merge selected components into one component set keeping existing layout | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Slash-name to variant conversion | Name/val1/val2 converts: prefix becomes set name, each segment a property value; needs equal slash count | P1 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Auto-generated property names | Converted properties named "Variant", "Property 2", "Property 3"... to be renamed | P1 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Add variant | "+" in sidebar, right-click > Main component > Add variant, or "+" below set; duplicates last variant | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Add variant property to component | Add property > Variant turns a main component into a component set | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Duplicate variant | Cmd/Ctrl+D inside set creates another variant | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Drag component into set | Dragging a component into a set adds it as variant; no reflow of existing | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Variant property/value model | Properties (e.g. size, state) with values; each variant a unique combination; not all combos required | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Conflict error | Warns when two variants share identical value combination even if visually different | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Corrupted variant error | Flags variants whose layer name doesn't follow "Prop=Value, Prop=Value" syntax | P1 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Variant layer-name syntax | Variant name encodes property=value pairs; editable via layer name or sidebar | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Rename/reorder variant properties | Double-click to rename; drag to reorder; variant names re-syntaxed to match order | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Edit/reorder variant values | Edit property modal lists values; rename and drag to reorder | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Free variant placement | Variants placed anywhere in set, even overlapping; set resizable like frame | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Default single-column layout | New variants added in a single column with equal spacing | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Variant spacing fields | With all variants selected, adjust horizontal and vertical spacing (smart selection) | P1 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Default variant = top-left | Top-left variant is default, represents set in Assets and defines variant default values | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Component set styling | Default dashed purple stroke, no fill; fill and stroke editable | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Multi-edit variants | Edits to a layer apply to matching layers across selected variants | P1 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Instance variant picker | Instance shows dropdowns per variant property and toggles for boolean values | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Import all variants | Inserting one instance imports every variant of its set (performance cost) | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Component set description/doc links | Sets support descriptions and doc links like components | P0 | [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) |
| Delete last variant property | Deleting the only variant property deletes the whole set/main component | P1 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |

## Component properties

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Component properties panel | Consolidated Properties section on instances listing all editable props | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Property types | Five types: Boolean, Instance swap, Text, Variant, Slot | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Boolean property | True/false toggling nested layer visibility only; false = hidden | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Boolean: bind boolean variable as default | Default value can be a boolean variable | P1 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Boolean: apply via Appearance | Apply/create from Appearance section "Apply variable/property"; shown as purple pill | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Instance swap property | Marks nested instance swappable; default from local or library components | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Instance swap: preferred instances | Curated checkbox list shown first in swap menu; search for others | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Text property | Editable text string with default; edited from panel or canvas | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Text property: string variable default | Default can be bound to a string variable | P1 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Text property: no rich text | Panel edits drop rich formatting/list styles; edit on canvas to preserve | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Variant property | Defines variants of a set; only on component sets, can't detach from nested layer | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Create property modal | Name, default value, optional variable; "Create property" | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Create property from nested layer | Create+apply property directly from selected nested layer | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Switch applied property | Click purple pill to rebind layer to another property of same type | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Change default value | Edit default of text/boolean/instance-swap; reflects on instances without overrides | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Expose nested instances | Surface nested instances' properties on top-level instance panel | P1 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Exposed instance hover highlight | Hovering property row highlights matching object on canvas in light purple | P1 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Exposed nested + hidden boolean | Hidden nested instance hides its exposed properties too | P1 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Detach property from layer | Unlink text/swap/boolean property from layer without deleting property | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Rename/reorder/delete properties | Double-click rename, drag handle reorder, right-click/Delete key to delete | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Property ordering rule | Variant properties always above other types; reorder only within type group | P0 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Boolean vs prototyping caveat | Consolidating states into one component via boolean loses prototype connections | P1 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Simplified instances (deprecated) | Hiding props/layers deprecated Mar 23 2026; all props and layers now shown | P2 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |
| Dev Mode component playground | Try instance properties in inspect panel without changing design | P2 | [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) |

## Slots

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Slot property | Flexible area in component; instances add/resize/rearrange any content without detaching | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Convert frame to slot | Right-click, sidebar, or Cmd+Shift+S / Ctrl+Shift+S on nested frame | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Wrap in new slot | Wrap non-frame layer(s) or multi-selection in new slot | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Create slot property first | Create property > Slot, later assign to frame via Convert to slot dropdown | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot restriction: not top-level | Slot property can't bind to component's top-level layer | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slots across variants | Apply one slot property to matching layers across variants via multi-edit | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot frame properties | Slot supports auto layout, min/max size, fills, effects, variables like a frame | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot default content | Publish slot empty or with pre-populated default content | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot settings: name/description | Edit slot property name and description | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot settings: min/max layers | Optional minimum and/or maximum child count; guidance only, not enforced | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot settings: preferred instances | Curated components list; Add instances popup filters to preferred by default | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot settings: only allow preferred | Flags content not from preferred list (guidance) | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot settings: display empty slots | Persistently show pink indicator on empty slots (otherwise only on hover) | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot settings: fill counter-axis by default | Inserted items get Fill container on axis opposite slot's auto-layout flow | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Add content to slot | Draw with any tool, duplicate, drag from canvas/Assets, or "Add instances" popup | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot instance editable props | Fill, stroke, opacity, effects, name, export editable; position, flow, constraints locked | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot limits display | Limits label: green check met, orange warning unmet; bottom toast when exceeded | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| View non-preferred layers | "View layers" highlights offending layers on canvas | P2 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slot [Modified] tag | Overridden slot property tagged [Modified] in properties panel | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Reset slot | More actions > Reset slot, or Reset specific changes > Reset <slot> property | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Clear slot | More actions > Delete contents removes all slot children | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Remove slot property | Delete property keeps frame; instances' slot content reset (destructive) | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Remove slot frame keep property | Cmd+Shift+G / Ctrl+Shift+G removes frame, keeps property and contents | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| No component properties inside slots | Layers in a slot can't take component properties; moved layers lose them | P1 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slots in Code Connect | Map slot child content into code snippets | P2 | [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design) |
| Slots vs instance swap vs variants guidance | Swap = rigid one-instance; slot = freeform; variants = states/types | P1 | [The difference between slots, instance swaps, and variants](https://help.figma.com/hc/en-us/articles/38741465279895-The-difference-between-slots-instance-swaps-and-variants) |
| Migrate placeholder slots | Workflow: detach/delete placeholder, add frame, Convert to slot, hide old from publishing | P2 | [Migrate a library to using slots](https://help.figma.com/hc/en-us/articles/38607529833751-Migrate-a-library-to-using-slots) |

## Interactive components

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Change to action | Prototype action switching instance to another variant of same set | P1 | [Create interactive components with variants](https://help.figma.com/hc/en-us/articles/360061175334-Create-interactive-components-with-variants) |
| Variant interactions travel with instances | Instances inherit set's interactions automatically in prototypes | P1 | [Create interactive components with variants](https://help.figma.com/hc/en-us/articles/360061175334-Create-interactive-components-with-variants) |
| Change to on nested instance | Nested instance interaction can change parent component's variant | P1 | [Create interactive components with variants](https://help.figma.com/hc/en-us/articles/360061175334-Create-interactive-components-with-variants) |
| Same-trigger precedence | Instance-level interaction overrides variant interaction with same trigger | P1 | [Create interactive components with variants](https://help.figma.com/hc/en-us/articles/360061175334-Create-interactive-components-with-variants) |
| Different-trigger stacking | Instance and variant interactions with different triggers both run | P1 | [Create interactive components with variants](https://help.figma.com/hc/en-us/articles/360061175334-Create-interactive-components-with-variants) |
| Variant interactions section | Prototype panel shows separate read-only "Variant interactions" list | P1 | [Create interactive components with variants](https://help.figma.com/hc/en-us/articles/360061175334-Create-interactive-components-with-variants) |
| Override variant interaction per instance | Instance can override; main edits via Go to main component | P1 | [Create interactive components with variants](https://help.figma.com/hc/en-us/articles/360061175334-Create-interactive-components-with-variants) |
| Override preservation across variants | Default-variant overrides (label text, swapped icon) persist when variant changes | P1 | [Create interactive components with variants](https://help.figma.com/hc/en-us/articles/360061175334-Create-interactive-components-with-variants) |
| Variables with interactive components | Clicking updates variant and bound variable, updating other bound elements | P2 | [Create interactive components with variants](https://help.figma.com/hc/en-us/articles/360061175334-Create-interactive-components-with-variants) |
| Custom font fallback in variants | Viewer lacking custom font may see Inter when variant changes font settings | P1 | [Create interactive components with variants](https://help.figma.com/hc/en-us/articles/360061175334-Create-interactive-components-with-variants) |
| Interactive component state | Variant state memorized, shared across matching instances, resettable per interaction (see State management) | P1 | [Create interactive components with variants](https://help.figma.com/hc/en-us/articles/360061175334-Create-interactive-components-with-variants) |

## Documentation and descriptions

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Component description | Short description on main, set, or individual variant; used in asset search | P0 | [Add descriptions to styles, components, and variables](https://help.figma.com/hc/en-us/articles/7938814091287-Add-descriptions-to-styles-components-and-variables) |
| Component documentation link | External URL attached to component/set/variant | P1 | [Add descriptions to styles, components, and variables](https://help.figma.com/hc/en-us/articles/7938814091287-Add-descriptions-to-styles-components-and-variables) |
| Descriptions kept on combine | Combining components into a set keeps per-variant descriptions/links | P1 | [Add descriptions to styles, components, and variables](https://help.figma.com/hc/en-us/articles/7938814091287-Add-descriptions-to-styles-components-and-variables) |
| Style description | Description in Edit style menu; shown on hover in style picker | P0 | [Add descriptions to styles, components, and variables](https://help.figma.com/hc/en-us/articles/7938814091287-Add-descriptions-to-styles-components-and-variables) |
| Variable description | Edit variable > description box | P1 | [Add descriptions to styles, components, and variables](https://help.figma.com/hc/en-us/articles/7938814091287-Add-descriptions-to-styles-components-and-variables) |
| Library publish description | Change note on publish shown in library modal and version history | P1 | [Add descriptions to styles, components, and variables](https://help.figma.com/hc/en-us/articles/7938814091287-Add-descriptions-to-styles-components-and-variables) |
| Description surfaces | Instance menu (Show more), Assets hover, style/library picker tooltip, Dev Mode, view-only Properties panel | P1 | [Add descriptions to styles, components, and variables](https://help.figma.com/hc/en-us/articles/7938814091287-Add-descriptions-to-styles-components-and-variables) |
| Variant shows set + variant description | Instance of variant shows both set and variant descriptions | P1 | [Add descriptions to styles, components, and variables](https://help.figma.com/hc/en-us/articles/7938814091287-Add-descriptions-to-styles-components-and-variables) |
| Edit style from picker | Right-click style in picker > Edit style | P0 | [Add descriptions to styles, components, and variables](https://help.figma.com/hc/en-us/articles/7938814091287-Add-descriptions-to-styles-components-and-variables) |

## Libraries: publish and manage

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Library concept | Components, styles, variables in one file reused across other files | P1 | [Guide to libraries in Figma](https://help.figma.com/hc/en-us/articles/360041051154-Guide-to-libraries-in-Figma) |
| Publish library | Assets tab > Libraries > This file > Publish; needs ≥1 component/style/variable | P1 | [Publish a library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library) |
| Publish: per-asset checklist | Lists added/modified/removed assets; uncheck items or "Changes" to exclude | P1 | [Publish a library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library) |
| Publish: description | Prompted for change description each publish; shown in updates and version history | P1 | [Publish a library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library) |
| Library name from file name | Library inherits its source file's name | P1 | [Publish a library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library) |
| Publish disabled states | Button disabled when no assets or no publishable changes | P1 | [Publish a library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library) |
| Unpublished changes stay local | Edits to published assets affect only source file until republished | P1 | [Publish a library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library) |
| Drafts cannot publish | File in drafts must move to a folder before publishing | Local: any file on disk publishable | [Publish a library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library) |
| Publish destination (team/org/workspace) | Org/Enterprise choose team, org, or workspace audience; may force permission change | Local: N/A, no accounts | [Publish a library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library) |
| Paid-plan gating | Libraries only on paid plans; Starter can create but not publish | Local: N/A, all free | [Publish a library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library) |
| Unread updates badge | Blue badge on Libraries icon when updates or unpublished changes exist | P1 | [Publish a library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library) |
| Unpublish library | Remove file from library; existing instances remain but stop updating | P1 | [Unpublish a library](https://help.figma.com/hc/en-us/articles/360039236853-Unpublish-a-library) |
| Hide when publishing (component) | Right-click in Assets; moves to Hidden section; excluded from library | P1 | [Hide styles, components, and variables when publishing](https://help.figma.com/hc/en-us/articles/360039238193-Hide-styles-components-and-variables-when-publishing) |
| Hide via name prefix | Component name starting with "." or "_" is private/not published | P1 | [Hide styles, components, and variables when publishing](https://help.figma.com/hc/en-us/articles/360039238193-Hide-styles-components-and-variables-when-publishing) |
| Hide style from publishing | Right-click style in publish modal > Hide/Show when publishing | P1 | [Hide styles, components, and variables when publishing](https://help.figma.com/hc/en-us/articles/360039238193-Hide-styles-components-and-variables-when-publishing) |
| Hide variable from publishing | Edit variable > "Hide from publishing" checkbox | P1 | [Hide styles, components, and variables when publishing](https://help.figma.com/hc/en-us/articles/360039238193-Hide-styles-components-and-variables-when-publishing) |
| Hide variable collection | Prefix collection name with "_" or "." to exclude from publishing | P1 | [Hide styles, components, and variables when publishing](https://help.figma.com/hc/en-us/articles/360039238193-Hide-styles-components-and-variables-when-publishing) |
| Go to style definition | From style in use, open source library file at style definition | P1 | [Hide styles, components, and variables when publishing](https://help.figma.com/hc/en-us/articles/360039238193-Hide-styles-components-and-variables-when-publishing) |
| Move style definition into this file | Pull remote style into current file; removed from original on republish | P1 | [Hide styles, components, and variables when publishing](https://help.figma.com/hc/en-us/articles/360039238193-Hide-styles-components-and-variables-when-publishing) |
| Move published components | Cut/paste published components between files, keeping instance links via publish | P2 | [Move published components](https://help.figma.com/hc/en-us/articles/4404848314647-Move-published-components) |
| Move: "Move to this file" vs "Publish as copy" | Per-component choice on publish: keep instance links or create new ids | P2 | [Move published components](https://help.figma.com/hc/en-us/articles/4404848314647-Move-published-components) |
| Move: stable component ids | Each component has unique id linking instances; paste creates new id | P0 | [Move published components](https://help.figma.com/hc/en-us/articles/4404848314647-Move-published-components) |
| Move: constraints | Hidden components can't move; deleted variants not copied; not undoable/version-restorable | P2 | [Move published components](https://help.figma.com/hc/en-us/articles/4404848314647-Move-published-components) |
| Move: auto-enable destination library | Subscribed files auto-enable new library when instances update | P2 | [Move published components](https://help.figma.com/hc/en-us/articles/4404848314647-Move-published-components) |
| Paste components into branch | Moves in branch apply after merge and publish | P2 | [Move published components](https://help.figma.com/hc/en-us/articles/4404848314647-Move-published-components) |
| Copy/paste mains across files | Pasted main components become new components; same-file links preserved | P0 | [Move published components](https://help.figma.com/hc/en-us/articles/4404848314647-Move-published-components) |
| Library guidelines files (AI) | Upload .md/.txt/.json guidance for agent; 200 KB combined cap; rename/replace/delete | P2 | [Add guidelines files to a design library](https://help.figma.com/hc/en-us/articles/43509372175511-Add-guidelines-files-to-a-design-library) |
| Library analytics | Org usage/detach tracking of components; moved components counted as new | Local: N/A, optional local usage scan | [Move published components](https://help.figma.com/hc/en-us/articles/4404848314647-Move-published-components) |

## Libraries: subscribe and use

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Libraries modal | Search libraries, browse, view assets, Add to file, Open file | P1 | [Add or remove a library from a design file](https://help.figma.com/hc/en-us/articles/1500008731201-Add-or-remove-a-library-from-a-design-file) |
| Browse libraries tabs | Recommended, Your teams, Your organization (by workspace), UI kits | Local: browse library folders on disk | [Add or remove a library from a design file](https://help.figma.com/hc/en-us/articles/1500008731201-Add-or-remove-a-library-from-a-design-file) |
| Add library to file | Enables library's components, styles, variables for everyone in file | P1 | [Add or remove a library from a design file](https://help.figma.com/hc/en-us/articles/1500008731201-Add-or-remove-a-library-from-a-design-file) |
| Remove library from file | Right-click in Assets; used assets remain on canvas | P1 | [Add or remove a library from a design file](https://help.figma.com/hc/en-us/articles/1500008731201-Add-or-remove-a-library-from-a-design-file) |
| Approved library badge | Admin-approved check mark (Enterprise) | Local: N/A, no admins | [Add or remove a library from a design file](https://help.figma.com/hc/en-us/articles/1500008731201-Add-or-remove-a-library-from-a-design-file) |
| Team default libraries | Admins enable library for Design, FigJam, Slides, Buzz, or All files | Local: default libraries in app settings | [Enable a library for a team](https://help.figma.com/hc/en-us/articles/360039234953-Enable-a-library-for-a-team) |
| Team default variable mode | Enterprise: default mode for library collection (≥2 modes) on new files | Local: per-project default mode setting | [Enable a library for a team](https://help.figma.com/hc/en-us/articles/360039234953-Enable-a-library-for-a-team) |
| Drafts library access | Account settings enable libraries for all draft files (Design/FigJam/All) | Local: global default libraries setting | [Enable access to libraries in your drafts](https://help.figma.com/hc/en-us/articles/360038743434-Enable-access-to-libraries-in-your-drafts) |
| Leave library file | Disabling keeps assets in search; leave file via Share modal to remove | Local: N/A, remove library path | [Remove your access to a library](https://help.figma.com/hc/en-us/articles/360038743894-Remove-your-access-to-a-library) |
| Go to main component from Assets | Right-click asset > Go to main component opens library file | P1 | [Remove your access to a library](https://help.figma.com/hc/en-us/articles/360038743894-Remove-your-access-to-a-library) |
| UI kits access toggle | Admins enable/disable UI kits for team/org | Local: N/A, bundled kits optional | [Enable a library for a team](https://help.figma.com/hc/en-us/articles/360039234953-Enable-a-library-for-a-team) |
| Library updates panel | Updates tab lists changed assets; current page by default, "Show updates for all pages" toggle | P1 | [Review and accept library updates](https://help.figma.com/hc/en-us/articles/360039234193-Review-and-accept-library-updates) |
| Update / Update all | Accept individual asset or all; applies across all pages | P1 | [Review and accept library updates](https://help.figma.com/hc/en-us/articles/360039234193-Review-and-accept-library-updates) |
| Per-selection update indicator | "Update available" icon on selected instance/style; Update selected or Review | P1 | [Review and accept library updates](https://help.figma.com/hc/en-us/articles/360039234193-Review-and-accept-library-updates) |
| Review update: side-by-side | Default compare view of old vs new asset | P1 | [Review and accept library updates](https://help.figma.com/hc/en-us/articles/360039234193-Review-and-accept-library-updates) |
| Review update: overlay + opacity slider | Overlay new on current with opacity slider for visual diff | P1 | [Review and accept library updates](https://help.figma.com/hc/en-us/articles/360039234193-Review-and-accept-library-updates) |
| Review update: step through instances | Arrows cycle instances on canvas; Update instance individually or all | P1 | [Review and accept library updates](https://help.figma.com/hc/en-us/articles/360039234193-Review-and-accept-library-updates) |
| Ignore updates | Editors may decline/ignore pending updates; instances stay on old version | P1 | [Guide to libraries in Figma](https://help.figma.com/hc/en-us/articles/360041051154-Guide-to-libraries-in-Figma) |
| Swap library | Replace styles, components, variables with name-matched assets from another library | P1 | [Swap libraries](https://help.figma.com/hc/en-us/articles/4404856784663-Swap-libraries) |
| Swap library: match checklist | Name matching incl. sets/variants; checkboxes, preview, "None found" for unmatched | P1 | [Swap libraries](https://help.figma.com/hc/en-us/articles/4404856784663-Swap-libraries) |
| Swap default styles in instances | Option: apply matched styles as overrides vs keep main's default styles | P2 | [Swap libraries](https://help.figma.com/hc/en-us/articles/4404856784663-Swap-libraries) |
| Missing libraries view | Lists assets from unpublished/inaccessible libraries grouped by origin with counts | P1 | [Swap libraries](https://help.figma.com/hc/en-us/articles/4404856784663-Swap-libraries) |
| Swap missing library | Replace orphaned assets with name-matched assets from chosen library | P1 | [Swap libraries](https://help.figma.com/hc/en-us/articles/4404856784663-Swap-libraries) |
| Undo swap library | Undo in session, swap back, or restore version; reset overrides | P1 | [Swap libraries](https://help.figma.com/hc/en-us/articles/4404856784663-Swap-libraries) |
| UI kits | Curated libraries: Material 3, Simple Design System, Apple iOS/iPadOS 26 & 18, macOS, watchOS, visionOS 26 | Local: bundled starter kit libraries | [Start designing with UI kits](https://help.figma.com/hc/en-us/articles/24037724065943-Start-designing-with-UI-kits) |
| UI kit: add/remove from file | Libraries modal > UI kits > Add to file / Remove | P2 | [Start designing with UI kits](https://help.figma.com/hc/en-us/articles/24037724065943-Start-designing-with-UI-kits) |
| UI kit: use in new file / make copy | Community: open kit in new file, or duplicate (copy stops receiving updates) | P2 | [Start designing with UI kits](https://help.figma.com/hc/en-us/articles/24037724065943-Start-designing-with-UI-kits) |
| UI kit updates | Kit authors push updates; accepted per file via library updates | Local: N/A, manual kit file refresh | [Start designing with UI kits](https://help.figma.com/hc/en-us/articles/24037724065943-Start-designing-with-UI-kits) |
| UI kit admin toggles | Global UI kits on/off and per-kit team toggles | Local: N/A, no admins | [Start designing with UI kits](https://help.figma.com/hc/en-us/articles/24037724065943-Start-designing-with-UI-kits) |
| Apple kit EULA gate | Accept Apple Design Resources license on first insert; PDF downloadable | Local: N/A, kit licensing user-side | [Get started with Apple's UI kit](https://help.figma.com/hc/en-us/articles/24037833895831-Get-started-with-Apple-s-UI-kit) |
| SF Pro font licensing | Optional SF Pro/SF Compact license; disagree prompts font replace; local install preferred | Local: use locally installed fonts | [Get started with Apple's UI kit](https://help.figma.com/hc/en-us/articles/24037833895831-Get-started-with-Apple-s-UI-kit) |

## Instances: insert, override, swap, detach

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Insert from Assets tab | Opt+2 / Alt+2 opens Assets; drag component to canvas to create instance | P0 | [Create and insert component instances](https://help.figma.com/hc/en-us/articles/360039150173-Create-and-insert-component-instances) |
| Assets view options | Grid or list view; show/hide sub-folders; search | P0 | [Create and insert component instances](https://help.figma.com/hc/en-us/articles/360039150173-Create-and-insert-component-instances) |
| Component details modal | Shows docs, source library, default preview; Insert instance or drag preview | P1 | [Create and insert component instances](https://help.figma.com/hc/en-us/articles/360039150173-Create-and-insert-component-instances) |
| Component playground (insert) | Preview variants, set props and nested props, change variable modes before inserting | P1 | [Create and insert component instances](https://help.figma.com/hc/en-us/articles/360039150173-Create-and-insert-component-instances) |
| Quick insert | Shift+I opens searchable component inserter (Actions/Resources) with grid/list | P0 | [Create and insert component instances](https://help.figma.com/hc/en-us/articles/360039150173-Create-and-insert-component-instances) |
| Duplicate main creates instance | Cmd/Ctrl+D or Alt-drag of main component yields an instance | P0 | [Create and insert component instances](https://help.figma.com/hc/en-us/articles/360039150173-Create-and-insert-component-instances) |
| Copy/paste main creates instance | Paste of main in same file creates instance; instances paste across files | P0 | [Create and insert component instances](https://help.figma.com/hc/en-us/articles/360039150173-Create-and-insert-component-instances) |
| Instance menu (swap) | Click component name: related group, search, library switcher, folder nav, grid/list | P0 | [Swap components and instances](https://help.figma.com/hc/en-us/articles/360039150413-Swap-components-and-instances) |
| Swap via Assets drag + modifier | Drag with Opt (Opt+Cmd if nested) / Alt (Alt+Ctrl) over instance to replace | P1 | [Swap components and instances](https://help.figma.com/hc/en-us/articles/360039150413-Swap-components-and-instances) |
| Swap via quick insert | Shift+I with selection, hold Opt/Ctrl when choosing to replace | P1 | [Swap components and instances](https://help.figma.com/hc/en-us/articles/360039150413-Swap-components-and-instances) |
| Swap via right-click | Right-click > Swap instance lists related components | P0 | [Swap components and instances](https://help.figma.com/hc/en-us/articles/360039150413-Swap-components-and-instances) |
| Overridable properties | Text (font, weight, size, line height, spacing, resizing), fill, stroke, effects, layout guides, nested swaps, export, name | P0 | [Apply changes to instances](https://help.figma.com/hc/en-us/articles/360039150733-Apply-changes-to-instances) |
| Non-overridable structure | Can't change layer order, child positions (incl. auto layout), constraints, text bounds | P0 | [Apply changes to instances](https://help.figma.com/hc/en-us/articles/360039150733-Apply-changes-to-instances) |
| Override preservation rule | Kept on swap/variant change if layer names match and original values matched | P0 | [Apply changes to instances](https://help.figma.com/hc/en-us/articles/360039150733-Apply-changes-to-instances) |
| Text override preservation | Text overrides kept when text layer name and hierarchy similar | P0 | [Apply changes to instances](https://help.figma.com/hc/en-us/articles/360039150733-Apply-changes-to-instances) |
| Assets-drag swap keeps only text | Swap by Assets drag preserves only text overrides | P1 | [Swap components and instances](https://help.figma.com/hc/en-us/articles/360039150413-Swap-components-and-instances) |
| Reset overrides | More actions lists changed props; Reset [property] or Reset all changes, per instance or layer | P0 | [Apply changes to instances](https://help.figma.com/hc/en-us/articles/360039150733-Apply-changes-to-instances) |
| Detach instance | Opt+Cmd+B / Ctrl+Alt+B, instance menu, or right-click; becomes frame, link removed | P0 | [Detach an instance from the component](https://help.figma.com/hc/en-us/articles/360038665754-Detach-an-instance-from-the-component) |
| Un-componentize workaround | Undo, or create instance, detach, delete main | P0 | [Detach an instance from the component](https://help.figma.com/hc/en-us/articles/360038665754-Detach-an-instance-from-the-component) |
| Instance properties controls | Toggles (boolean), swap dropdowns with icon, text fields, variant dropdowns | P0 | [Edit instances with component properties](https://help.figma.com/hc/en-us/articles/8883757553943-Edit-instances-with-component-properties) |
| Component properties in plugin API | Properties readable/writable from plugins | P2 | [Edit instances with component properties](https://help.figma.com/hc/en-us/articles/8883757553943-Edit-instances-with-component-properties) |

## Styles

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Style types | Five: color, text, effect, layout guide, animation | P0 | [Guide to styles in Figma](https://help.figma.com/hc/en-us/articles/360039238753-Guide-to-styles-in-Figma) |
| Color style | Fill, stroke, image, gradient (incl. angle), pattern, shader fill | P0 | [Guide to styles in Figma](https://help.figma.com/hc/en-us/articles/360039238753-Guide-to-styles-in-Figma) |
| Text style | Font family, size, weight, line height, letter spacing; whole layer or text range | P0 | [Guide to styles in Figma](https://help.figma.com/hc/en-us/articles/360039238753-Guide-to-styles-in-Figma) |
| Effect style | Multiple effects: drop/inner shadow, layer/background blur, texture, noise, shader | P0 | [Guide to styles in Figma](https://help.figma.com/hc/en-us/articles/360039238753-Guide-to-styles-in-Figma) |
| Layout guide style | Rows, columns, uniform grid; icon varies by type | P0 | [Guide to styles in Figma](https://help.figma.com/hc/en-us/articles/360039238753-Guide-to-styles-in-Figma) |
| Animation style | Position, scale, rotation, size, opacity, path; timing/easing variables; Motion only | Module | [Guide to styles in Figma](https://help.figma.com/hc/en-us/articles/360039238753-Guide-to-styles-in-Figma) |
| Style icon variants | Shadow style icon reflects type and x/y; layout guide icon reflects type | P1 | [Guide to styles in Figma](https://help.figma.com/hc/en-us/articles/360039238753-Guide-to-styles-in-Figma) |
| Create style from Local styles | "+" next to Local styles, pick type, name, description, configure | P0 | [Create and edit styles](https://help.figma.com/hc/en-us/articles/360038746534-Create-and-edit-styles) |
| Create style from object | Style picker > New style from selected object's property; remove sub-properties with "-" | P0 | [Create and edit styles](https://help.figma.com/hc/en-us/articles/360038746534-Create-and-edit-styles) |
| Local styles list | Right sidebar with nothing selected lists file's styles grouped by type | P0 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Style folders | Add new folder from selection; folder path rewrites style name (A / B / name) | P0 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Slash-name style grouping | "Group/Name" prefixes group styles under headings | P0 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Delete folder | Deletes folder and its styles; or move styles out first | P0 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Reorder/move styles | Shift/Cmd multi-select and drag to reorder or into folder (renames) | P0 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Edit style panel | Name, description, properties; hide/show property on objects; remove property | P0 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Style edits propagate | Changing a style updates all objects using it in the file | P0 | [Guide to styles in Figma](https://help.figma.com/hc/en-us/articles/360039238753-Guide-to-styles-in-Figma) |
| Copy/paste styles across files | Right-click Copy style; Paste here in destination; appended to list | P0 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Move styles between files | Cut styles/folders, paste in destination, publish; not undoable | P2 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Duplicate style | Right-click > Duplicate style places copy directly below | P0 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Delete style | Objects keep values but detach from style; multi-select delete | P0 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Style picker | Per-property picker: search, list/grid, library filter dropdown, New style | P0 | [Apply styles to layers and objects](https://help.figma.com/hc/en-us/articles/360040316193-Apply-styles-to-layers-and-objects) |
| Style picker ordering | Alphabetical by team, then file, then local order | P1 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Style vs variable thumbnails | Styles shown as round swatches, color variables as square | P0 | [Apply styles to layers and objects](https://help.figma.com/hc/en-us/articles/360040316193-Apply-styles-to-layers-and-objects) |
| Apply style | Select objects, open picker on property, choose style | P0 | [Apply styles to layers and objects](https://help.figma.com/hc/en-us/articles/360040316193-Apply-styles-to-layers-and-objects) |
| Eyedropper samples style | Eyedropper can sample a color style and apply it | P1 | [Apply styles to layers and objects](https://help.figma.com/hc/en-us/articles/360040316193-Apply-styles-to-layers-and-objects) |
| Color picker palettes | Document colors ("On this page") or library palettes; sets raw color not style | P0 | [Apply styles to layers and objects](https://help.figma.com/hc/en-us/articles/360040316193-Apply-styles-to-layers-and-objects) |
| Switch style | Click applied style to open picker and choose another | P0 | [Apply styles to layers and objects](https://help.figma.com/hc/en-us/articles/360040316193-Apply-styles-to-layers-and-objects) |
| Detach style | Hover style and click detach; object keeps values | P0 | [Apply styles to layers and objects](https://help.figma.com/hc/en-us/articles/360040316193-Apply-styles-to-layers-and-objects) |
| Library styles read-only | Library styles usable but editable only in source file | P1 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |
| Library shortcut | Opt+3 / Alt+3 opens library modal | P1 | [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles) |

## Design system linting (Check designs)

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Check designs | Finds hard-coded colors, text, radius, spacing and wrong-library assets in selection | P2 | [Check designs in Figma](https://help.figma.com/hc/en-us/articles/39592284074263-Check-designs-in-Figma) |
| Check designs: tabs | Colors, Dimensions, Typography, Components | P2 | [Check designs in Figma](https://help.figma.com/hc/en-us/articles/39592284074263-Check-designs-in-Figma) |
| Check designs: suggestions | Ranked by similarity, naming, usage; exact = "Match"; non-AI | P2 | [Check designs in Figma](https://help.figma.com/hc/en-us/articles/39592284074263-Check-designs-in-Figma) |
| Check designs: components flagged only | Detached/wrong-library components flagged, not auto-fixed | P2 | [Check designs in Figma](https://help.figma.com/hc/en-us/articles/39592284074263-Check-designs-in-Figma) |
| Check designs: color contrast | Contrast check at AA or AAA level | P2 | [Check designs in Figma](https://help.figma.com/hc/en-us/articles/39592284074263-Check-designs-in-Figma) |
| Check designs: preview | Click row recenters; hover highlights layers; hover value previews change | P2 | [Check designs in Figma](https://help.figma.com/hc/en-us/articles/39592284074263-Check-designs-in-Figma) |
| Check designs: apply | Apply all, single, Cmd-click multi, Shift range, section group; undoable | P2 | [Check designs in Figma](https://help.figma.com/hc/en-us/articles/39592284074263-Check-designs-in-Figma) |
| Check designs: settings | Row counts toggle, libraries to check against, contrast level | P2 | [Check designs in Figma](https://help.figma.com/hc/en-us/articles/39592284074263-Check-designs-in-Figma) |
| Check designs: limits | One page at a time; 25K layer selection cap; can't swap color styles | P2 | [Check designs in Figma](https://help.figma.com/hc/en-us/articles/39592284074263-Check-designs-in-Figma) |
| Check designs: entry points | Right-click, section Ready for Dev dropdown, Actions menu; Reload re-runs | P2 | [Check designs in Figma](https://help.figma.com/hc/en-us/articles/39592284074263-Check-designs-in-Figma) |

## Variables: collections, types, scopes

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Variables view | Left nav Variables tab; full-window view, sidebar toggle, Minimize to resizable modal, Expand | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Create variable | + Create variable, pick type, name and value columns | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Create variable via eyedropper | Eyedropper can create a variable from sampled value | P2 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Variables per collection limit | Up to 5,000 variables per collection | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Duplicate variable | Select variables, Shift+Enter duplicates | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Delete variable | Right-click > Delete variable | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Alias variable | Value references another same-type variable (local or library); Create/Detach alias | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Copy/paste variables | Copy variables to any collection, including other files | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Edit variable modal | Name, description, per-mode values, code syntax, hide from publishing, scope | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Scope: number variables | Gap, padding, corner radius, font weight/size, line height, letter/paragraph spacing, paragraph indent, opacity, effects, stroke, text content, width/height | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Scope: color variables | Effects, frame fill, shape fill, stroke, text fill | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Scope: string variables | Font family, font weight or style, text string | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Scope: Show in all | Checkbox making variable available for all supported properties | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Code syntax | Per-platform names: Web, Android, iOS (max 3); shown in CSS/SwiftUI/Compose snippets | P2 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Bulk edit variables | Multi-select > Edit variables: scope and hide from publishing | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Search variables | Search by name, value, or group; filter by type | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Create collection | More options > Create collection (requires an existing variable) | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Rename/delete collection | Delete removes all variables and unbinds properties; undo or version restore only | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Reorder collections | Drag order or Sort A to Z; affects pickers and mode selector | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Variable groups | New group with selection; nest by drag; rename, ungroup, duplicate, delete | P1 | [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections) |
| Extended collections | Child collection inherits parent's variables/modes; overrides per brand (Enterprise) | P2 | [Extend a variable collection](https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection) |
| Extended: override highlight + reset | Overridden values shown blue; Reset change reverts to parent | P2 | [Extend a variable collection](https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection) |
| Extended: restrictions | Can't add variables/modes or change description/scope in extension | P2 | [Extend a variable collection](https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection) |
| Extended: color+opacity coupling | Overriding color or opacity marks both overridden | P2 | [Extend a variable collection](https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection) |
| Export mode to JSON | Right-click mode > Export mode writes variables to JSON | P1 | [Extend a variable collection](https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection) |
| Import mode from JSON | Right-click mode > Import mode overwrites values from JSON | P1 | [Extend a variable collection](https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection) |
| Variables REST/Plugin API | Query/create/update/delete variables; bind to components; widgets read/create | P2 | [Guide to variables in Figma](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma) |
| Variables to code sync | GitHub Action example syncs variables with codebase | Local: tokens file on disk, git-friendly | [Guide to variables in Figma](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma) |
| Variable types | Six: Color, Number, String, Boolean, Timing (ms), Easing (curve/spring) | P1 | [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) |
| Color variable | Solid color with opacity; applies to color styles, fills, gradient stops, shadows, strokes, other color vars | P1 | [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) |
| Color variable: number-bound opacity | Opacity can bind number var; clamps <0 to 0%, >100 to 100%; alias color keeps own opacity | P2 | [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) |
| Number variable | Integers or decimals to hundredths; used for dimensions, type, guides, opacity, padding, effects, stroke, text | P1 | [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) |
| Number variable: range rules | Font weight numeric (400/700); letter spacing px; row/col count integer; opacity clamped 0-100 | P1 | [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) |
| Number variable: effects and strokes | Shadow/blur X, Y, blur, spread; stroke weight all/top/bottom/left/right; individual corner radii | P1 | [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) |
| String variable | Text; font family, style/weight name, text content, visibility ("true"/"false"), variants | P1 | [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) |
| Font-name normalization | Font strings matched ignoring case, hyphens, underscores, spaces | P1 | [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) |
| Boolean variable | True/false for layer visibility and true/false variant properties | P1 | [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) |
| Timing variable | Duration in ms for Motion preset delay/duration | Module | [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) |
| Easing variable | Pre-built/custom easing curve or spring for Motion presets and keyframes | Module | [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) |
| Styles vs variables model | Styles = composite stack; variables = single value per mode, aliasable, scopable | P1 | [The difference between variables and styles](https://help.figma.com/hc/en-us/articles/15871097384471-The-difference-between-variables-and-styles) |
| Styles backed by variables | Variables inside styles let styled layers switch with mode | P1 | [The difference between variables and styles](https://help.figma.com/hc/en-us/articles/15871097384471-The-difference-between-variables-and-styles) |

## Variables: applying to designs

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Apply color variable | Solid fills, strokes, gradient stops, shadow colors, color styles; mixed selection | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Libraries picker | Shared picker for styles and variables: search by name/group, filter by library | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Variables in styles | Color variables in color/gradient/shadow styles; string vars in text style font family/weight | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Apply number variable: "=" key | Type "=" in numeric field to open variable picker | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Number variable targets | Font size, gap, guide count/width/margin/offset/gutter, W/H, min/max W/H, radius, effects, padding, opacity, letter spacing, line height, paragraph indent/spacing, stroke weight | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Number variable entry methods | Dropdown "Apply variable", Apply icon, Shift+click field, or right-click | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| String variable: text content | Bind text layer content to string (or number) variable | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| String variable: font family/weight | Bind font family or weight/style to string variable | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Boolean variable: visibility | Right-click eye icon to bind; true = visible | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Apply: timing variable | Bind to Motion animation delay/duration | Module | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Apply: easing variable | Bind to Motion animation easing curve | Module | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Variables on variant instances | Boolean/number/string variables select variant values, switch by mode | P2 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Detach variable | Detach icon (color/string/boolean); Delete in field for numbers | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| On-canvas padding/gap edit detaches | Dragging padding/gap handles on canvas detaches bound number variable | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Eyedropper applies variables/styles | Eyedropper samples and applies existing variables and styles | P2 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |
| Paste unpublished variables across files | Toast offers copying variables into new collection; remaps by identical collection/var names | P1 | [Apply variables to designs](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs) |

## Variable modes

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Modes | Collection columns; one value per variable per mode (light/dark, locale, device) | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Mode count by plan | Max modes per collection depends on plan tier | Local: unlimited modes | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Create mode | New variable mode copies first column's values | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Duplicate mode | Right-click mode header > Duplicate mode | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Default mode | Left-most column; Set as default or drag left | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Reorder modes | Drag columns or Move column left/right | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Delete mode | Right-click mode > Delete mode | P1 | [Extend a variable collection](https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection) |
| Import DTCG tokens | Drag JSON files into new collection; one mode per file; tokens must exist in all files | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| DTCG type mapping | color(sRGB/HSL), dimension(px)->number, fontFamily->string, duration(s)->number, number, string | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| DTCG boolean extension | com.figma.type "boolean" makes number token boolean (0 false) | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| DTCG aliases | "{red}" references; cross-collection via com.figma.aliasData (id/set id/set name/name) | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Token name normalization | a.b.c becomes a/b/c; duplicate normalized names: first wins | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Export modes (all) | Right-click collection > Export modes to JSON | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Set mode on object | Apply variable mode on layers, frames, groups, components, sets, sections | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Set mode on page | Page section > Apply variable mode when collection has multiple modes | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Mode tag in Layers | Layer shows mode icon+name tag; hover lists multiple modes | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Auto mode inheritance | Objects default to Auto: inherit parent mode up tree, then collection default | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Explicit vs default binding | Explicitly set mode stays even if default changes; Auto follows new default | P1 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Variables drive variants | Assign string/number var matching variant values, or boolean to true/false variant; nested too | P2 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |
| Mode conflicts | Info icon on modes when file has mixed variable versions; mode applies only where available | P2 | [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) |

## Prototyping: advanced logic

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Multiple actions | Unlimited actions per trigger; Add action; collapse/expand; drag reorder; run top-to-bottom | P1 | [Multiple actions and conditionals](https://help.figma.com/hc/en-us/articles/15253220891799-Multiple-actions-and-conditionals) |
| Sequential animations | Multiple animations on one trigger play sequentially | P1 | [Multiple actions and conditionals](https://help.figma.com/hc/en-us/articles/15253220891799-Multiple-actions-and-conditionals) |
| Conditional action | If boolean expression then actions, Else actions (optional); nest by drag | P2 | [Multiple actions and conditionals](https://help.figma.com/hc/en-us/articles/15253220891799-Multiple-actions-and-conditionals) |
| Invalid expression highlight | Invalid conditional statements outlined in red | P2 | [Multiple actions and conditionals](https://help.figma.com/hc/en-us/articles/15253220891799-Multiple-actions-and-conditionals) |
| Advanced examples | Required checkbox, form validation error overlay, selection counter, click counter, volume bar | P2 | [Advanced prototyping examples](https://help.figma.com/hc/en-us/articles/17146044893591-Advanced-prototyping-examples) |
| Variable bound to width | Number variable on layer width animated via Set variable expressions | P2 | [Advanced prototyping examples](https://help.figma.com/hc/en-us/articles/17146044893591-Advanced-prototyping-examples) |
| Expressions: where used | In Set variable "to" field and Conditional "if" field; type or use suggestion panel | P2 | [Use expressions in prototypes](https://help.figma.com/hc/en-us/articles/15253194385943-Use-expressions-in-prototypes) |
| Numeric operators | + - * / on number variables and literals | P2 | [Use expressions in prototypes](https://help.figma.com/hc/en-us/articles/15253194385943-Use-expressions-in-prototypes) |
| String concatenation | + joins quoted string literals, numbers, string/number variables | P2 | [Use expressions in prototypes](https://help.figma.com/hc/en-us/articles/15253194385943-Use-expressions-in-prototypes) |
| Boolean operators | == != and or > < >= <= with literals and variables | P2 | [Use expressions in prototypes](https://help.figma.com/hc/en-us/articles/15253194385943-Use-expressions-in-prototypes) |
| Operator precedence | Parentheses, then * /, then + -; comparisons, and, or; left to right | P2 | [Use expressions in prototypes](https://help.figma.com/hc/en-us/articles/15253194385943-Use-expressions-in-prototypes) |
| Negative numbers and negation | Unary minus; "!" or "not" negates booleans (toggles) | P2 | [Use expressions in prototypes](https://help.figma.com/hc/en-us/articles/15253194385943-Use-expressions-in-prototypes) |
| Expression validation | Invalid expressions outlined red; Enter confirms | P2 | [Use expressions in prototypes](https://help.figma.com/hc/en-us/articles/15253194385943-Use-expressions-in-prototypes) |
| Set variable action | Pick target variable; set string, number, boolean, or color (hex) value or variable | P1 | [Use variables in prototypes](https://help.figma.com/hc/en-us/articles/14506587589399-Use-variables-in-prototypes) |
| Variable changes propagate | Set variable / Change to / Set variable mode update every bound element live | P1 | [Use variables in prototypes](https://help.figma.com/hc/en-us/articles/14506587589399-Use-variables-in-prototypes) |
| Variable-bound variant switching in prototype | Setting variable to matching value swaps instance's variant | P2 | [Use variables in prototypes](https://help.figma.com/hc/en-us/articles/14506587589399-Use-variables-in-prototypes) |
| Mode-scoped Set variable | Set variable inside a layer with explicit mode updates only that mode's value | P2 | [Variable modes in prototypes](https://help.figma.com/hc/en-us/articles/15253268379799-Variable-modes-in-prototypes) |
| Mode references in expressions | variableName:modeName via Modes dropdown or ← then ↑/↓ in expression builder | P2 | [Variable modes in prototypes](https://help.figma.com/hc/en-us/articles/15253268379799-Variable-modes-in-prototypes) |
| Set variable mode action | Change current page's mode for a collection; Auto objects follow, explicit modes kept | P1 | [Variable modes in prototypes](https://help.figma.com/hc/en-us/articles/15253268379799-Variable-modes-in-prototypes) |

## Prototyping: animation and transitions

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Smart animate | Animates matching layers (by name + hierarchy) between frames | P1 | [Smart animate layers between frames](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames) |
| Smart animate properties | Scale/size, position, opacity (layer and fill), rotation, fill (solid, gradient, image) | P1 | [Smart animate layers between frames](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames) |
| Smart animate effects support | Texture, noise, layer/background blur supported; drop/inner shadow and shape morph fall back to dissolve | P1 | [Smart animate layers between frames](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames) |
| Smart animate new/unchanged layers | New layers dissolve in; unchanged layers don't animate | P1 | [Smart animate layers between frames](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames) |
| Smart animate and overlays | Not for opening overlays; works when swapping overlays with matching layers | P1 | [Smart animate layers between frames](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames) |
| Smart animate matching layers | Checkbox with other transitions: matches smart-animate, rest use main transition | P1 | [Smart animate layers between frames](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames) |
| Fixed layer rules with matching | Matching fixed layers: no transition; non-matching fixed: dissolve | P1 | [Smart animate layers between frames](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames) |
| Hierarchy-aware slide/move | With matching layers, Move/Slide animate layers by z-order; frame fill not animated | P1 | [Smart animate layers between frames](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames) |
| Matching layer highlight | In Prototype tab, hovering a layer highlights its matches in other frames | P1 | [Smart animate layers between frames](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames) |
| Duplicate naming rules | Duplicates within frame number sequentially; copies across frames keep name | P0 | [Smart animate layers between frames](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames) |
| Animation settings | Animation type, direction (L/R/U/D), animate matching layers, easing/spring, duration, preview | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Duration range | 1 ms to 10000 ms | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Transition: Instant | Immediately show destination | P1 | [Prototype animations](https://help.figma.com/hc/en-us/articles/360040522373-Prototype-animations) |
| Transition: Dissolve | Fade destination over original; duration, easing | P1 | [Prototype animations](https://help.figma.com/hc/en-us/articles/360040522373-Prototype-animations) |
| Transition: Smart animate | Animate matching layers; duration, easing | P1 | [Prototype animations](https://help.figma.com/hc/en-us/articles/360040522373-Prototype-animations) |
| Transition: Move in / Move out | Slide destination over/out with original stationary; direction, easing, duration | P1 | [Prototype animations](https://help.figma.com/hc/en-us/articles/360040522373-Prototype-animations) |
| Transition: Push | Destination pushes original out; direction, easing, duration | P1 | [Prototype animations](https://help.figma.com/hc/en-us/articles/360040522373-Prototype-animations) |
| Transition: Slide in / Slide out | Moves destination with offset and dissolve of original; direction, easing, duration | P1 | [Prototype animations](https://help.figma.com/hc/en-us/articles/360040522373-Prototype-animations) |
| Easing presets | Linear, Ease in, Ease out, Ease in and out, Ease in back, Ease out back, Ease in and out back | P1 | [Prototype easing and spring animations](https://help.figma.com/hc/en-us/articles/360051748654-Prototype-easing-and-spring-animations) |
| Custom bezier editor | Cubic bezier graph, draggable handles, numeric x1 y1 x2 y2, overshoot allowed | P1 | [Prototype easing and spring animations](https://help.figma.com/hc/en-us/articles/360051748654-Prototype-easing-and-spring-animations) |
| Spring presets | Gentle, Quick, Bouncy, Slow, Custom | P1 | [Prototype easing and spring animations](https://help.figma.com/hc/en-us/articles/360051748654-Prototype-easing-and-spring-animations) |
| Custom spring | Stiffness, Damping, Mass fields + draggable graph; mass changes derived duration | P1 | [Prototype easing and spring animations](https://help.figma.com/hc/en-us/articles/360051748654-Prototype-easing-and-spring-animations) |
| Copy easing values | Copy/paste numeric curve values; custom curves can't be saved as presets | P2 | [Prototype easing and spring animations](https://help.figma.com/hc/en-us/articles/360051748654-Prototype-easing-and-spring-animations) |
| Animation hover preview | Hover preview window in Interaction details to play animation | P1 | [Prototype easing and spring animations](https://help.figma.com/hc/en-us/articles/360051748654-Prototype-easing-and-spring-animations) |

## Prototyping: connections and interactions

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Interaction model | Trigger + one or more actions; hotspot, connection "noodle", destination | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Destination must be top-level frame | Except Scroll to, which targets layers within same frame | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Create connection by drag | Drag "+" node from hovered hotspot to destination, or "+" in Interactions | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Hide interaction panel with Shift | Hold Shift to hide Interaction details panel before interacting | P2 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Bulk create interactions | Multi-select hotspots, drag one node to destination or set via panel | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Interaction details panel | Trigger, action, destination, animation, state management (reset), Add action | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Trigger multiplicity rules | Unlimited Key/Gamepad, On drag, When video hits; one each of other triggers per object | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Click + hover exclusion | On click can't coexist with While hovering; use Mouse enter/leave | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Select matching interactions | Select identical action+destination on matching-name objects across frames; edit together | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Matching connections collapsed | Only first (top-left) of matching connections drawn until selected | P2 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Bulk retarget connections | Shift-select or marquee connections and drag to new destination | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Copy/paste interactions | Cmd/Ctrl+C or X on interaction, paste onto other object | P1 | [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) |
| Inherited connections from main | Connections on main component apply to instances (main must be on same page; not library) | P1 | [Add prototype connections from main components](https://help.figma.com/hc/en-us/articles/4404380377367-Add-prototype-connections-from-main-components) |
| Inherited connections hidden | Inherited connections shown only when instance selected | P1 | [Add prototype connections from main components](https://help.figma.com/hc/en-us/articles/4404380377367-Add-prototype-connections-from-main-components) |
| Design/Prototype tab toggle | Shift+E toggles Design and Prototype tabs | P1 | [Guide to prototyping in Figma](https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma) |
| Toggle connections visibility | Shift+E or View settings > Prototyping toggle shows/hides noodles and flow starts | P1 | [View prototype connections](https://help.figma.com/hc/en-us/articles/4411431245335-View-prototype-connections) |
| Connection details readout | Trigger, action+destination, animation+direction, easing, duration in Interactions section | P1 | [View prototype connections](https://help.figma.com/hc/en-us/articles/4411431245335-View-prototype-connections) |
| Read-only connections for viewers | Viewers see connections/flows (hidden by default) and variant interactions on mains | Local: read-only open mode | [View prototype connections](https://help.figma.com/hc/en-us/articles/4411431245335-View-prototype-connections) |

## Prototyping: flows and overlays

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Flow | Set of connected frames from one starting point; frames can be in multiple flows | P1 | [Create and manage prototype flows](https://help.figma.com/hc/en-us/articles/360039823894-Create-and-manage-prototype-flows) |
| Auto-created starting point | First connection from unconnected frame creates flow start; blue icon with name | P1 | [Create and manage prototype flows](https://help.figma.com/hc/en-us/articles/360039823894-Create-and-manage-prototype-flows) |
| Manual flow starting point | "+" in Flow starting point section; one per top-level frame | P1 | [Create and manage prototype flows](https://help.figma.com/hc/en-us/articles/360039823894-Create-and-manage-prototype-flows) |
| Flows list | Prototype tab with nothing selected lists flows; Select frame, Preview | P1 | [Create and manage prototype flows](https://help.figma.com/hc/en-us/articles/360039823894-Create-and-manage-prototype-flows) |
| Rename flow | Default "Flow 1, 2..."; rename in panel or double-click canvas label | P1 | [Create and manage prototype flows](https://help.figma.com/hc/en-us/articles/360039823894-Create-and-manage-prototype-flows) |
| Flow description | Rich text (bold, lists, links) shown in presentation sidebar | P1 | [Create and manage prototype flows](https://help.figma.com/hc/en-us/articles/360039823894-Create-and-manage-prototype-flows) |
| Move flow starting point | Drag blue flow label to another frame | P1 | [Create and manage prototype flows](https://help.figma.com/hc/en-us/articles/360039823894-Create-and-manage-prototype-flows) |
| Delete flow starting point | Remove starting point button, or drag label off frame | P1 | [Create and manage prototype flows](https://help.figma.com/hc/en-us/articles/360039823894-Create-and-manage-prototype-flows) |
| Inline flow preview | Play flow inside editor from Flows list or blue start icon | P1 | [Create and manage prototype flows](https://help.figma.com/hc/en-us/articles/360039823894-Create-and-manage-prototype-flows) |
| Copy flow link | Copy link to specific flow from canvas or presentation view | Local: export flow as shareable HTML | [Create and manage prototype flows](https://help.figma.com/hc/en-us/articles/360039823894-Create-and-manage-prototype-flows) |
| Open overlay | Show frame above current screen; settings stored on overlay frame, reused | P1 | [Create overlays in your prototypes](https://help.figma.com/hc/en-us/articles/360039818254-Create-overlays-in-your-prototypes) |
| Overlay position | 7 presets (center, top/bottom left/center/right) or manual | P1 | [Create overlays in your prototypes](https://help.figma.com/hc/en-us/articles/360039818254-Create-overlays-in-your-prototypes) |
| Overlay: close when clicking outside | Dismiss overlay on outside click | P1 | [Create overlays in your prototypes](https://help.figma.com/hc/en-us/articles/360039818254-Create-overlays-in-your-prototypes) |
| Overlay: background | Optional background color and opacity behind overlay | P1 | [Create overlays in your prototypes](https://help.figma.com/hc/en-us/articles/360039818254-Create-overlays-in-your-prototypes) |
| Swap overlay | Replace current overlay keeping position; not recorded in Back history | P1 | [Create overlays in your prototypes](https://help.figma.com/hc/en-us/articles/360039818254-Create-overlays-in-your-prototypes) |
| Overlay indicator | Blue overlay icon beside frame opens its settings | P1 | [Create overlays in your prototypes](https://help.figma.com/hc/en-us/articles/360039818254-Create-overlays-in-your-prototypes) |
| Delete overlay / connection | Drag arrow to empty canvas, select icon + Delete | P1 | [Create overlays in your prototypes](https://help.figma.com/hc/en-us/articles/360039818254-Create-overlays-in-your-prototypes) |
| Remove all interactions | Right-click connection > Remove all interactions on page | P1 | [Create overlays in your prototypes](https://help.figma.com/hc/en-us/articles/360039818254-Create-overlays-in-your-prototypes) |
| Add starting point via right-click | Right-click frame > Add starting point; duplicating frame copies starting point | P1 | [Guide to prototyping in Figma](https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma) |
| Section as destination | Connection to a section returns to last-visited frame in it | P2 | [Use sections in prototyping](https://help.figma.com/hc/en-us/articles/16194160540567-Use-sections-in-prototyping) |

## Prototyping: triggers and actions

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Action: Navigate to | Go to another top-level frame | P1 | [Prototype actions](https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions) |
| Action: Back | Return to previous frame in history | P1 | [Prototype actions](https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions) |
| Action: Scroll to | Scroll frame or nested scroller to any object in top-level frame; Instant or Animate | P1 | [Prototype actions](https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions) |
| Scroll to target picking | Panel picker: direct children of scrollers only; drag noodle for any object | P1 | [Prototype actions](https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions) |
| Action: Open link | Open external URL in new tab; leaving-Figma jump page skippable per device | P1 | [Prototype actions](https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions) |
| Action: Close overlay | Dismiss open overlay | P1 | [Prototype actions](https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions) |
| Action: Play/pause video | Play, Pause, or Toggle play/pause on target video | P1 | [Prototype actions](https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions) |
| Action: Mute/unmute video | Mute, Unmute, or Toggle mute | P1 | [Prototype actions](https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions) |
| Action: Set to specific time | Seek video to timestamp; beyond length jumps to end (loop restarts) | P1 | [Prototype actions](https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions) |
| Action: Jump forward/backward | Skip N seconds forward or back in video | P1 | [Prototype actions](https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions) |
| Action types (full list) | Navigate to, Back, Set variable, Set variable mode, Conditional, Scroll to, Open link, Open/Close/Swap overlay, video actions, Change to | P1 | [Prototype actions](https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions) |
| Trigger: On click / On tap | Fires on click (desktop) or tap (mobile) | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Trigger: On drag | Drag left/right/up/down; transition scrubs with drag progress | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Trigger: While hovering | Active during hover; reverts to original frame on leave | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Trigger: While pressing | Active while held (long-press); reverts on release | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Trigger: Key/Gamepad | Single key, key combo, or controller button; Xbox One, PS4, Switch Pro supported | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Trigger: Mouse enter | Fires once when cursor enters hotspot | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Trigger: Mouse leave | Fires once when cursor leaves hotspot | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Legacy: Mouse move inside/outside | Pre-Nov 2023 interactions relabeled; fire on every move; can't create new | P2 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Trigger: Mouse down / Touch down | Fires on initial press | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Trigger: Mouse up / Touch up | Fires on release (pair with down for dropdowns) | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Trigger: After delay | Fires after N ms on frame | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Trigger: When video hits | Fires at video timestamp; beyond length fires at end | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |
| Trigger: When video ends | Fires when video finishes | P1 | [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers) |

## Prototyping: scroll and state

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Scroll overflow | Frame Overflow: No scrolling, Horizontal, Vertical, Both directions (top-level or nested) | P1 | [Prototype scroll and overflow behavior](https://help.figma.com/hc/en-us/articles/360039818734-Prototype-scroll-and-overflow-behavior) |
| Overflow content warning | Error when content isn't larger than frame | P1 | [Prototype scroll and overflow behavior](https://help.figma.com/hc/en-us/articles/360039818734-Prototype-scroll-and-overflow-behavior) |
| Resize ignoring constraints | Hold Cmd/Ctrl while resizing frame to skip constraints/auto layout | P0 | [Prototype scroll and overflow behavior](https://help.figma.com/hc/en-us/articles/360039818734-Prototype-scroll-and-overflow-behavior) |
| Scroll position: Scroll with parent | Default; layer moves with scroll | P1 | [Prototype scroll and overflow behavior](https://help.figma.com/hc/en-us/articles/360039818734-Prototype-scroll-and-overflow-behavior) |
| Scroll position: Fixed | Layer stays put; moved above others, labeled Fixed; auto layout needs absolute position | P1 | [Prototype scroll and overflow behavior](https://help.figma.com/hc/en-us/articles/360039818734-Prototype-scroll-and-overflow-behavior) |
| Scroll position: Sticky | In vertical scrollers, sticks at parent top; bounded by direct parent; z-order from layers | P1 | [Prototype scroll and overflow behavior](https://help.figma.com/hc/en-us/articles/360039818734-Prototype-scroll-and-overflow-behavior) |
| Auto layout canvas stacking | Last on top (default) or First on top affects sticky stacking | P0 | [Prototype scroll and overflow behavior](https://help.figma.com/hc/en-us/articles/360039818734-Prototype-scroll-and-overflow-behavior) |
| Preserve scroll position (default) | Scroll of top-level frames and scrollers memorized and shared across matching layers | P1 | [Preserve scroll position in prototypes](https://help.figma.com/hc/en-us/articles/360051747774-Preserve-scroll-position-in-prototypes) |
| Scroll matching rules | Nested: same name + same parents; top-level: same name or "Prefix /" match | P1 | [Preserve scroll position in prototypes](https://help.figma.com/hc/en-us/articles/360051747774-Preserve-scroll-position-in-prototypes) |
| Reset scroll position | Per-interaction checkbox in State section | P1 | [Preserve scroll position in prototypes](https://help.figma.com/hc/en-us/articles/360051747774-Preserve-scroll-position-in-prototypes) |
| Legacy state management upgrade | Old interactions show Update button to adopt May 2023 rules | P2 | [Preserve scroll position in prototypes](https://help.figma.com/hc/en-us/articles/360051747774-Preserve-scroll-position-in-prototypes) |
| Bulk rename with prefix | Cmd/Ctrl+R rename panel; "Current Name" token for prefixing | P0 | [Preserve scroll position in prototypes](https://help.figma.com/hc/en-us/articles/360051747774-Preserve-scroll-position-in-prototypes) |
| State memorization | Remembers component variant, scroll position, video play state on return | P1 | [State management for prototypes](https://help.figma.com/hc/en-us/articles/14397859494295-State-management-for-prototypes) |
| State sharing | Matching objects across frames share variant, scroll, video state | P1 | [State management for prototypes](https://help.figma.com/hc/en-us/articles/14397859494295-State-management-for-prototypes) |
| State reset options | Reset scroll position, Reset component state, Reset video state; shown only when relevant | P1 | [State management for prototypes](https://help.figma.com/hc/en-us/articles/14397859494295-State-management-for-prototypes) |
| Update all legacy interactions | Success banner offers Update all after updating one | P2 | [State management for prototypes](https://help.figma.com/hc/en-us/articles/14397859494295-State-management-for-prototypes) |

## Prototyping: media (GIF, video)

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Animated GIF fills | GIF as fill on any shape/text; plays only in presentation, static in editor | P1 | [Use animated GIFs in prototypes](https://help.figma.com/hc/en-us/articles/360041486873-Use-animated-GIFs-in-prototypes) |
| GIF image size limit | Width/height >4096 px auto-scaled down | P1 | [Use animated GIFs in prototypes](https://help.figma.com/hc/en-us/articles/360041486873-Use-animated-GIFs-in-prototypes) |
| GIF label | GIF badge in fill section, fill modal, layers, canvas dimension label | P1 | [Use animated GIFs in prototypes](https://help.figma.com/hc/en-us/articles/360041486873-Use-animated-GIFs-in-prototypes) |
| GIF poster frame | Choose which GIF frame shows on canvas | P2 | [Use animated GIFs in prototypes](https://help.figma.com/hc/en-us/articles/360041486873-Use-animated-GIFs-in-prototypes) |
| GIF metadata | Keeps frame delay and loop count metadata | P2 | [Use animated GIFs in prototypes](https://help.figma.com/hc/en-us/articles/360041486873-Use-animated-GIFs-in-prototypes) |
| GIF restrictions | No image adjustments; no animated GIF export (static only) | P1 | [Use animated GIFs in prototypes](https://help.figma.com/hc/en-us/articles/360041486873-Use-animated-GIFs-in-prototypes) |
| GIF supports transforms | Scale, rotate, opacity, fill mode, blend, masks, styles, components, overflow | P1 | [Use animated GIFs in prototypes](https://help.figma.com/hc/en-us/articles/360041486873-Use-animated-GIFs-in-prototypes) |
| Video fill | Video as fill on any shape; .mp4/.mov H.264 or .webm VP8; max 300 MB | P1 | [Use videos in prototypes](https://help.figma.com/hc/en-us/articles/8878274530455-Use-videos-in-prototypes) |
| Add video | Drag-drop, fill importer, Place image/video bulk tool, copy layer, paste clipboard | P1 | [Use videos in prototypes](https://help.figma.com/hc/en-us/articles/8878274530455-Use-videos-in-prototypes) |
| Video sizing on add | Canvas drop uses file dimensions; fill on object keeps object size/name | P1 | [Use videos in prototypes](https://help.figma.com/hc/en-us/articles/8878274530455-Use-videos-in-prototypes) |
| Video fill controls | Play/preview, jump to timestamp, scrub in Fill section; video icon in Layers | P1 | [Use videos in prototypes](https://help.figma.com/hc/en-us/articles/8878274530455-Use-videos-in-prototypes) |
| Video edits | Scale, rotate, crop, reposition, fill mode, rotation, blend modes, masks | P1 | [Use videos in prototypes](https://help.figma.com/hc/en-us/articles/8878274530455-Use-videos-in-prototypes) |
| Video properties | Autoplay checkbox, Loop toggle, default Sound on/off | P1 | [Use videos in prototypes](https://help.figma.com/hc/en-us/articles/8878274530455-Use-videos-in-prototypes) |
| Same-frame video interactions | Hotspot controls video in same frame (custom player) | P1 | [Use videos in prototypes](https://help.figma.com/hc/en-us/articles/8878274530455-Use-videos-in-prototypes) |
| Video + smart animate continuity | Matching video layers keep progress across frames when reset off | P2 | [Use videos in prototypes](https://help.figma.com/hc/en-us/articles/8878274530455-Use-videos-in-prototypes) |
| Video upload gating | Upload paid-only; Starter can edit existing video | Local: N/A, all free | [Use videos in prototypes](https://help.figma.com/hc/en-us/articles/8878274530455-Use-videos-in-prototypes) |

## Prototype playback, presentation, and device settings

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Prototype settings | Device + model, background color, starting frame, orientation (whole prototype) | P1 | [Guide to prototyping in Figma](https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma) |
| Device presets | Device list filtered by frame size; frame preset auto-selects matching device | P1 | [Set prototype device and background settings](https://help.figma.com/hc/en-us/articles/21158597546391-Set-prototype-device-and-background-settings) |
| Device: inline preview limits | Inline preview shows only phone, watch, tablet devices | P2 | [Set prototype device and background settings](https://help.figma.com/hc/en-us/articles/21158597546391-Set-prototype-device-and-background-settings) |
| Device: Custom size (Fit) | Scales design to viewer screen; no device frame | P1 | [Set prototype device and background settings](https://help.figma.com/hc/en-us/articles/21158597546391-Set-prototype-device-and-background-settings) |
| Device: Presentation (Full) | Whole slide-like fit on screen; no device frame | P1 | [Set prototype device and background settings](https://help.figma.com/hc/en-us/articles/21158597546391-Set-prototype-device-and-background-settings) |
| Orientation | Portrait or Landscape for whole prototype; no mid-prototype switching | P1 | [Set prototype device and background settings](https://help.figma.com/hc/en-us/articles/21158597546391-Set-prototype-device-and-background-settings) |
| Device model | Model/color variants (e.g. iPhone 15 Pro Max 4 colors) | P2 | [Set prototype device and background settings](https://help.figma.com/hc/en-us/articles/21158597546391-Set-prototype-device-and-background-settings) |
| Device preview | Thumbnail preview of device in settings | P2 | [Set prototype device and background settings](https://help.figma.com/hc/en-us/articles/21158597546391-Set-prototype-device-and-background-settings) |
| Presentation background color | Custom color behind device in presentation | P1 | [Set prototype device and background settings](https://help.figma.com/hc/en-us/articles/21158597546391-Set-prototype-device-and-background-settings) |
| Inline preview | Play in editor (Preview button, flow icon, Shift+Space); live-updates with edits | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Inline preview controls | Back/forward arrows, Restart (R), scaling menu, open in presentation, close, resize (Shift proportional) | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Inline: Follow prototype | Canvas selection/viewport follows current preview frame | P2 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Inline: Respect aspect ratio / 100% | Window matches frame ratio or resizes to 100% of frame | P2 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Presentation view | Cmd+Opt+Return / Ctrl+Alt+Enter opens prototype in separate tab/window | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Presentation toolbar | Flows sidebar, comment mode, spotlight/follow, share, options, fullscreen | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Presentation footer | Prev/next arrows, device switcher, Restart (R) to flow start | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Option: Enable Figma shortcuts | Toggle keyboard shortcuts (C comments, F fullscreen, arrows) | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Option: Show hints on click | Clicking non-hotspot flashes blue boxes on clickable areas | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Option: Hide UI | Hides toolbar/footer/sidebar; adds &hide-ui=1 to share URL | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Scaling without device | Actual size, Responsive, Fit width, Fit width and height, Fill screen | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Default scaling rules | >1024px first frame: Actual size; narrower: Actual; 16:9/Presentation: Fill screen; Custom: Fit | P2 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Responsive scaling | Viewer resize re-lays out via constraints and auto layout | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Scaling with device | Responsive or Fixed size; Fit device, Zoom to fill, 100%, show/hide device frame | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Cycle scale shortcut | Z cycles scaling options in presentation | P2 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Frame navigation keys | → / Space / N next, ← previous | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Navigation order | With flow: visit history; without: frames by x then y | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| No connections fallback | Without connections, step through all frames on page | P1 | [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes) |
| Present offline | Options > Advanced > Make available offline preloads; keep tab open; not mobile | Local: always offline | [Present prototypes offline](https://help.figma.com/hc/en-us/articles/26463081577367-Present-prototypes-offline) |
| Accessibility mode | Screen-reader mode (VoiceOver, JAWS, NVDA) via Skip to content or Options; desktop only | P2 | [Accessible prototypes in Figma](https://help.figma.com/hc/en-us/articles/7810391964695-Accessible-prototypes-in-Figma) |
| A11y HTML mapping | Navigate/Open link = links, others buttons; image alt = layer name; frames/components = labeled sections; lists | P2 | [Accessible prototypes in Figma](https://help.figma.com/hc/en-us/articles/7810391964695-Accessible-prototypes-in-Figma) |
| A11y tab order | Tab follows layer order; auto layout follows flow order | P2 | [Accessible prototypes in Figma](https://help.figma.com/hc/en-us/articles/7810391964695-Accessible-prototypes-in-Figma) |
| Mobile app presentation | Play prototype in native app from flow start; double-tap-hold reveals options | Local: N/A, use mobile browser export | [View prototypes on a mobile device](https://help.figma.com/hc/en-us/articles/360040321093-View-prototypes-on-a-mobile-device) |
| Mobile prototype options | Switch flows, restart, view file, Fixed/Responsive scale, hotspot hints, share, exit | P2 | [View prototypes on a mobile device](https://help.figma.com/hc/en-us/articles/360040321093-View-prototypes-on-a-mobile-device) |
| Mirror selected frame | Live-mirror selected desktop top-level frame on phone (app or figma.com/mirror) | Local: LAN preview server with QR code | [View prototypes on a mobile device](https://help.figma.com/hc/en-us/articles/360040321093-View-prototypes-on-a-mobile-device) |
| Mobile browser playback | Open prototype link in mobile browser; hotspots only, no browser back | Local: export standalone HTML prototype | [View prototypes on a mobile device](https://help.figma.com/hc/en-us/articles/360040321093-View-prototypes-on-a-mobile-device) |

## Branching and merging

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Create branch | File menu > Create branch; named exact copy of main; File > Branch label | P2 | [Guide to branching](https://help.figma.com/hc/en-us/articles/360063144053-Guide-to-branching) |
| Branch URL identity | Branch links contain /branch/ plus unique id | Local: branch stored as sibling file/folder | [Guide to branching](https://help.figma.com/hc/en-us/articles/360063144053-Guide-to-branching) |
| Update from main | Preview added/changed/removed items; apply all (no cherry-pick) | P2 | [Get updates from main files](https://help.figma.com/hc/en-us/articles/5665728006423-Get-updates-from-main-files) |
| Conflict resolution | Side-by-side main vs branch per conflict; pick each; Resolve all: Pick main / Pick branch | P2 | [Get updates from main files](https://help.figma.com/hc/en-us/articles/5665728006423-Get-updates-from-main-files) |
| Memory limit blocks merge | Active memory-limit banner disables review/merge and updates | P2 | [Get updates from main files](https://help.figma.com/hc/en-us/articles/5665728006423-Get-updates-from-main-files) |
| Review and merge modal | Changes grouped by page (added/edited/removed); side-by-side or overlay with opacity; zoom in/out/fit; prev/next | P2 | [Merge branch into main file](https://help.figma.com/hc/en-us/articles/5691189138839-Merge-branch-into-main-file) |
| Merge branch | Apply all branch changes to main, auto-archive branch; no partial merge | P2 | [Merge branch into main file](https://help.figma.com/hc/en-us/articles/5691189138839-Merge-branch-into-main-file) |
| Merge name and description | Edit merge name/description in toast or version history | P2 | [Merge branch into main file](https://help.figma.com/hc/en-us/articles/5691189138839-Merge-branch-into-main-file) |
| Branch version checkpoints | Branch created, Updated from main, Before merge, Branch merged entries in history | P2 | [Guide to branching](https://help.figma.com/hc/en-us/articles/360063144053-Guide-to-branching) |
| Undo merge/update | Restore earlier version of branch or main; incomplete merge recovery | P2 | [Incomplete merges or updates](https://help.figma.com/hc/en-us/articles/5691750511383-Incomplete-merges-or-updates) |
| Request review | Pick reviewers (suggested editors, search), description, Send; in-app + email notify | Local: N/A, export diff for review | [Request a branch review](https://help.figma.com/hc/en-us/articles/5691414603543-Request-a-branch-review) |
| Review statuses | In review (gray), Changes suggested (yellow), Approved; resend request | Local: N/A, solo workflow | [Request a branch review](https://help.figma.com/hc/en-us/articles/5691414603543-Request-a-branch-review) |
| Reviewer actions | Approve, Suggest changes, approve+merge; edit review; review again; whole-branch only | Local: N/A, solo workflow | [Review branch changes](https://help.figma.com/hc/en-us/articles/5693123873687-Review-branch-changes) |
| Change detail view | Shows changed layers and specific properties per change | P2 | [Review branch changes](https://help.figma.com/hc/en-us/articles/5693123873687-Review-branch-changes) |
| Share/invite to branch | Copy link or invite with view/edit; grants main view access | Local: N/A, share file on disk | [Share a branch](https://help.figma.com/hc/en-us/articles/5665697002263-Share-a-branch) |
| Branches modal | Tabs: Active, Archived (incl. merged), Yours; open, copy link, merge, archive, rename, restore | P2 | [View and manage branches](https://help.figma.com/hc/en-us/articles/5668839659415-View-and-manage-branches) |
| Archive / restore branch | Archive unmerged branch; restore archived (not merged) branch | P2 | [View and manage branches](https://help.figma.com/hc/en-us/articles/5668839659415-View-and-manage-branches) |
| Duplicate branch as new file | Detached file copy "Main : branch (Copy)" | P2 | [View and manage branches](https://help.figma.com/hc/en-us/articles/5668839659415-View-and-manage-branches) |
| Branch indicator in file browser | Branch icon and count on file tile; dropdown to open branch | Local: branch list in file browser | [View and manage branches](https://help.figma.com/hc/en-us/articles/5668839659415-View-and-manage-branches) |
| Branch comments isolated | Main comments absent in branch; branch comments not merged | P2 | [Guide to branching](https://help.figma.com/hc/en-us/articles/360063144053-Guide-to-branching) |
| Publish only from main | Library/Community publishing only from main file | P2 | [Guide to branching](https://help.figma.com/hc/en-us/articles/360063144053-Guide-to-branching) |
| Branching plan gating | Org/Enterprise, Full seat; viewers need copy/share/export allowed | Local: N/A, all free | [Guide to branching](https://help.figma.com/hc/en-us/articles/360063144053-Guide-to-branching) |

## Comments

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Comment mode | C or toolbar enters comment mode; canvas edits disabled; Esc exits | P2 | [Guide to comments in Figma](https://help.figma.com/hc/en-us/articles/360039825314-Guide-to-comments-in-Figma) |
| Pin comment | Click to pin at point; attaches to top-level frame/component/group and moves with it | P2 | [Add comments to files](https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files) |
| Region comment | Click-drag to comment on a rectangular region | P2 | [Add comments to files](https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files) |
| Comment attachment scope | Comments never attach to nested frames/layers, only top-level containers | P2 | [Add comments to files](https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files) |
| @mentions | Mention people or user groups; visibility rules by plan; email + in-app notify | Local: N/A, no accounts | [Add comments to files](https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files) |
| Comment media | Up to 5 PNG/JPEG/GIF attachments per comment; drag, paste, or picker | P2 | [Add comments to files](https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files) |
| Comment emoji | Emoji picker (Apple set), frequently used, search | P2 | [Add comments to files](https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files) |
| Comment rate limit | Max 100 comments/replies per hour per user | Local: N/A, no server limits | [Add comments to files](https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files) |
| Comment text styling | Bold, italic, strikethrough, link, numbered/bulleted lists via shortcuts or markdown | P2 | [Add comments to files](https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files) |
| Time-stamped comments | Comment tied to Motion timeline timestamps; Insert timeline timestamp | Module | [Add comments to files](https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files) |
| Comment pins and clusters | Pins with hover preview; nearby pins cluster by zoom with count/avatars | P2 | [View and manage comments](https://help.figma.com/hc/en-us/articles/360041547593-View-and-manage-comments) |
| Comment thread actions | React, mark unread, copy link, delete, resolve, reply (Enter) | P2 | [View and manage comments](https://help.figma.com/hc/en-us/articles/360041547593-View-and-manage-comments) |
| Comments sidebar | Lists all comments with page; click navigates; search, sort, filter | P2 | [View and manage comments](https://help.figma.com/hc/en-us/articles/360041547593-View-and-manage-comments) |
| Sort and filter comments | Sort by date or unread; Only your threads; Show resolved | P2 | [View and manage comments](https://help.figma.com/hc/en-us/articles/360041547593-View-and-manage-comments) |
| Hide comments on canvas | Shift+C toggles comment visibility outside comment mode | P2 | [View and manage comments](https://help.figma.com/hc/en-us/articles/360041547593-View-and-manage-comments) |
| Resolve / unresolve | Resolve hides thread; unresolve via Show resolved filter | P2 | [View and manage comments](https://help.figma.com/hc/en-us/articles/360041547593-View-and-manage-comments) |
| Delete comment/thread | Own comments deletable; deleting parent deletes thread; not restorable via versions | P2 | [View and manage comments](https://help.figma.com/hc/en-us/articles/360041547593-View-and-manage-comments) |
| Edit comment | Edit own comment text; Save or discard | P2 | [Move or edit comments](https://help.figma.com/hc/en-us/articles/360041547853-Move-or-edit-comments) |
| Move comment pin | Drag pin to new location | P2 | [Move or edit comments](https://help.figma.com/hc/en-us/articles/360041547853-Move-or-edit-comments) |
| Comment behavior on layer moves | Cut/paste detaches; Move to page carries; cross-file paste/duplicate file doesn't copy | P2 | [Move or edit comments](https://help.figma.com/hc/en-us/articles/360041547853-Move-or-edit-comments) |
| Prototype comments | Comment in presentation view; synced to design file; hidden when UI hidden | P2 | [Comment on prototypes](https://help.figma.com/hc/en-us/articles/360039824594-Comment-on-prototypes) |
| Prototype comment options | Show resolved comments; Show only your comments | P2 | [Comment on prototypes](https://help.figma.com/hc/en-us/articles/360039824594-Comment-on-prototypes) |
| Mobile app commenting | Long-press canvas to comment | Local: N/A, desktop only | [Guide to comments in Figma](https://help.figma.com/hc/en-us/articles/360039825314-Guide-to-comments-in-Figma) |
| Email notification settings | Everything, Just mentions and replies, Nothing (mentions still emailed); in-app always on | Local: N/A, no accounts | [Manage email notifications for comments on files](https://help.figma.com/hc/en-us/articles/360041547813-Manage-email-notifications-for-comments-on-files) |
| Slack / Teams integration | Comment notifications and replies via Slack or Microsoft Teams | Local: N/A, no cloud | [Manage email notifications for comments on files](https://help.figma.com/hc/en-us/articles/360041547813-Manage-email-notifications-for-comments-on-files) |

## Multiplayer, presence, and handoff

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Spotlight me | Presenter broadcasts canvas view/zoom/page; followers auto-follow after "Not now" grace | P2 | [Present to collaborators using spotlight](https://help.figma.com/hc/en-us/articles/360040322673-Present-to-collaborators-using-spotlight) |
| Follow user | Click avatar to follow; colored canvas border; Stop following | P2 | [Present to collaborators using spotlight](https://help.figma.com/hc/en-us/articles/360040322673-Present-to-collaborators-using-spotlight) |
| Ask to spotlight | Request another user to spotlight; accept/reject | P2 | [Present to collaborators using spotlight](https://help.figma.com/hc/en-us/articles/360040322673-Present-to-collaborators-using-spotlight) |
| Spotlight in prototypes | Follow presenter in presentation view; remote-control from phone | P2 | [Present to collaborators using spotlight](https://help.figma.com/hc/en-us/articles/360040322673-Present-to-collaborators-using-spotlight) |
| Cursor chat | "/" or right-click opens live chat bubble at cursor; 52-char limit; fades after 5 s | P2 | [Use cursor chat in Figma Design](https://help.figma.com/hc/en-us/articles/4403130802199-Use-cursor-chat-in-Figma-Design) |
| Cursor chat controls | Esc clears; Enter new line replaces; exit by Esc, click, tool switch, menu; no log | P2 | [Use cursor chat in Figma Design](https://help.figma.com/hc/en-us/articles/4403130802199-Use-cursor-chat-in-Figma-Design) |
| Viewer history | Avatar menu lists current and previous viewers with last-visit time | Local: N/A, no accounts | [See viewer history for your files](https://help.figma.com/hc/en-us/articles/29638316371479-See-viewer-history-for-your-files) |
| Viewer history opt-out | Account setting to stop recording/seeing view history | Local: N/A, no accounts | [See viewer history for your files](https://help.figma.com/hc/en-us/articles/29638316371479-See-viewer-history-for-your-files) |
| Custom file thumbnail | Right-click frame > Set as thumbnail | P1 | [Optimize design files for developer handoff](https://help.figma.com/hc/en-us/articles/360040521453-Optimize-design-files-for-developer-handoff) |
| Ready for development marking | Mark sections/frames ready for dev | P2 | [Optimize design files for developer handoff](https://help.figma.com/hc/en-us/articles/360040521453-Optimize-design-files-for-developer-handoff) |
| Move to page | Right-click object (e.g. component) > Move to page | P0 | [Optimize design files for developer handoff](https://help.figma.com/hc/en-us/articles/360040521453-Optimize-design-files-for-developer-handoff) |
| View-only capabilities | Select layers, inspect, copy text, measure, comment, present, go to main, link dev resources | Local: read-only open mode | [Optimize design files for developer handoff](https://help.figma.com/hc/en-us/articles/360040521453-Optimize-design-files-for-developer-handoff) |
| Restrict viewer copy/export | File setting allowing/blocking viewers to copy, share, export | Local: N/A, file owner controls disk | [Optimize design files for developer handoff](https://help.figma.com/hc/en-us/articles/360040521453-Optimize-design-files-for-developer-handoff) |

## Notes

- Hard limits worth mirroring: 5,000 variables per collection; 6 variable types; prototype duration 1–10,000 ms; video fills .mp4/.mov (H.264) or .webm (VP8), max 300 MB; GIF/image edge capped at 4096 px; comments allow 5 attachments and 100 per hour; cursor chat 52 chars; library guidelines 200 KB total; Check designs capped at 25K layers on one page.
- Stable component and variable IDs drive everything: instance links, override preservation, moving published components, library swap (matched by name), and token import (matched by ID, then collection ID or name, then variable name). Illigma's file format needs globally unique, persistent IDs from v1.0.
- Override preservation is subtle and users notice when it breaks. On a variant switch, an override is kept only if layer names match and the original values matched across variants. Text overrides follow looser rules based on name and hierarchy.
- Library model maps well to local files: a "library" can be any .illigma file on disk referenced by path, "publish" becomes an explicit snapshot or version, and "accept updates" becomes diffing that snapshot against the cached copy. Side-by-side and overlay update review with an opacity slider is reusable for branch review.
- Variable modes resolve in layers: an explicit mode on a layer wins, then "Auto" inherits up the tree to the page mode, then the collection default (left-most column). Mode conflicts appear when a file mixes stale library versions, so a local library-versioning scheme has to handle chains of dependent libraries (file 1 → 2 → 3 → 4).
- DTCG JSON import/export of modes is a strong fit for local-first and git workflows. Supported types: color (sRGB/HSL), dimension (px only), fontFamily, duration (s only), number (boolean via com.figma.type), and string. Nested names become "/" paths, and the first duplicate wins.
- The prototype engine has a lot of surface area: 12 triggers, about 14 actions, 6 transitions with direction, 7 bezier presets plus a custom bezier, 4 spring presets plus custom stiffness, damping, and mass, smart animate layer matching, an expression language with operator precedence, if/else conditionals, and state management (memorize, share, reset) for scroll, variants, and video.
- State sharing and scroll preservation depend on matching by name: nested layers need the same name and the same parent chain, and top-level frames need the same name or the same "Prefix /". This needs a clear spec, because users will rely on it implicitly.
- Hard to build locally: branching and merging with per-conflict resolution (needs a structural 3-way diff of the scene graph), live mobile mirroring (needs a LAN server), screen-reader prototype mode (needs an HTML/ARIA mapping), and Check designs suggestion ranking, which uses usage data across the organization that doesn't exist locally.
- Slots (2026) are now a first-class component property type, with preferred instances, min/max layer counts (guidance only), and fill-counter-axis defaults. Combined with nested-instance exposure, they replace most variant-explosion workarounds and are worth prioritizing early in v1.x.
