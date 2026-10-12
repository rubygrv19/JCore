# JCore design direction

## Identity

- **Style:** Swiss Style / International Typographic Style, as requested by the project owner.
- **Character:** precise, calm, and information-led.
- **Palette:** black, white, and neutral grays. Do not use hue to communicate status or hierarchy; use labels, icons, weight, line style, and contrast.
- **Typography:** Inter, already configured through Nuxt Fonts. Use a clear scale, strong left-aligned headings, and restrained metadata.

## Layout

- Align content to a consistent grid and use rules to show relationships between sections and data.
- Prefer square, flat surfaces over nested rounded cards, shadows, and decorative tiles.
- Use whitespace to separate information groups; keep related values close and align labels with their values.
- Keep data charts legible in grayscale. Distinguish series with line style and markers as well as tone.
- Reflow the desktop grid for tablet and mobile; keep tables contained and controls usable at touch sizes.

## Component use

- Use Nuxt UI for standard controls, cards, badges, and navigation.
- Keep status text and accessible labels explicit so meaning does not depend on grayscale contrast alone.
- Retain decoration only when it supports navigation, grouping, or data interpretation.
