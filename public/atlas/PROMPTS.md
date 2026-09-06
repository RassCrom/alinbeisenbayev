# Atlas assets: generation record

Every raster under `public/atlas/` was generated with the Higgsfield MCP,
model `nano_banana_pro`, then cut out with its `remove_background` tool
(except `glow`, which is drawn additively and keeps its black ground).
Regenerate any of them by re-running the prompt below with the same
reference image; the seed is not exposed, so expect a sibling, not a twin.

The cutouts are PNG masters in `assets-src/atlas/` (gitignored, like the
video masters). `python scripts/prepare-atlas-assets.py` crops each to its
alpha box, pads to square, resizes and writes the `.webp` files here, and
bakes `src/atlas/masks.ts` from the island alpha. Re-run it after replacing
a master.

Reference images, uploaded once per session with `media_upload`:

- islands: `docs/concepts/06-realistic-archipelago-overview.png`, role `image_references`
- settlements: `docs/concepts/07-realistic-settlement-tiers.png`, role `image_references`

Generated on a flat pure black background on purpose: the cutout's residual
fringe is dark, and dark fringe disappears on a navy sea. A magenta or green
key would have left a visible halo.

## Islands (1:1, 2k, reference 06)

Shared frame, with the biome sentence swapped in:

> Top-down view of one single fictional island, painted photoreal
> strategy-game map art in exactly the style, palette and lighting of the
> reference image: dark cinematic grade, key light from the upper right, soft
> shadows falling toward the lower left, rich painted terrain detail.
> **{biome}**; roughly rounded outline with irregular bays and headlands. The
> island is completely uninhabited: no buildings, no settlements, no roads,
> no walls, no boats, no people, no text, no labels, no borders. The shore
> ends at the water's edge but NO water and NO sea is painted: the island is
> isolated on a flat pure black background that fills the rest of the frame.
> Centred, filling about 80% of the frame, one island only, no other
> landmasses.

| File | Island | Biome sentence |
| --- | --- | --- |
| `island-jailau.webp` | Jailau (social media) | Rolling green meadow island with soft grassy hills, hedgerows, small groves of broadleaf trees, a winding stream, wildflower patches and low sandy beaches |
| `island-tasqyr.webp` | Tasqyr (print) | Rugged mountain island with a snow-capped central massif, grey rock ridges, scree slopes, alpine meadows and a few pines at the foot, steep rocky coast with a small pebble beach |
| `island-qaragai.webp` | Qaragai (storytelling map) | Densely forested island of dark conifer pine and spruce woods with a few mossy clearings, a small dark lake, ferns, and a rocky northern shore |
| `island-tikjar.webp` | Tikjar (interactive map) | Sea-cliff island with tall pale limestone cliffs all around, a windswept grassy clifftop plateau with heather and a few bent trees, one sheltered cove with a shingle beach, and sea stacks at the edge |
| `island-qumtobe.webp` | Qumtöbe (game) | Desert island of golden sand dunes with wind ripples, a small dry oasis with a few palms and a tiny pool, dark rock outcrops on one side, and pale sandy shores |
| `island-ottas.webp` | Ottas (analysis) | Small rugged volcanic islet with a black basalt cone, a red glowing crater and thin glowing lava cracks, dark ash slopes, and a few hardy trees near a black-sand shore |
| `island-sazkol.webp` | Sazköl (platform) | Small marsh islet of reed beds, peat bog, shallow pools and meandering channels, mossy hummocks, a few wind-bent willows and muddy shores |

## Settlements (1:1, 1k, reference 07)

Shared frame:

> A single **{tier}** in exactly the painted photoreal style, camera angle
> and lighting of the reference image: high-angle three-quarter view from
> above, key light from the upper right, dark cinematic dusk grade, warm
> amber light in the windows. **{description}**. It stands on a small round
> patch of grass that fades out at its edges, isolated on a flat pure black
> background, nothing else in the frame, no text, no labels. Centred, filling
> about 70% of the frame.

| File | Tier | Description |
| --- | --- | --- |
| `settlement-fortress.webp` | large stone fortress | High curtain walls with battlements, a tall central keep with several round towers and conical slate roofs, a gatehouse, two small banners; patch of grass and rock |
| `settlement-walled-town.webp` | walled town | A ring of stone walls with a gate and two square towers enclosing a dense cluster of half-timbered houses with orange tiled roofs and one small church spire, thin chimney smoke |
| `settlement-market-town.webp` | market town | An open cluster of eight half-timbered houses with orange tiled roofs around a small square with market stalls and striped awnings, no walls, thin chimney smoke; patch of grass with a dirt path |
| `settlement-hamlet.webp` | hamlet | Three small cottages with thatched and wooden-shingle roofs, a low fence, a woodpile and a well, thin chimney smoke; fills about 60% of the frame |
| `settlement-ruin.webp` | old ruin | The crumbling remains of a small stone keep and broken walls, roofless, overgrown with moss and ivy, fallen stones around it, no lights, no smoke; no amber windows; fills about 60% of the frame |

## Small sprites (no reference)

| File | Size | Prompt |
| --- | --- | --- |
| `glow.webp` | 1:1, 1k | A single soft warm amber light glow: one round radial gradient of orange-gold light, brightest at the centre, fading smoothly and evenly to pure black at the edges, centred on a flat pure black background. No objects, no lens flare, no text, nothing else in the frame. *(No background removal: drawn with additive blending, where black is transparent.)* |
| `crown.webp` | 1:1, 1k | A small flat gold heraldic crown emblem for a map legend, like a game user-interface icon: simple silhouette with five points and small round jewels, thin elegant matte gold lines and fills, softly lit from the upper right, front view, isolated on a flat pure black background, centred, filling about 60% of the frame, no text, nothing else in the frame. |
| `pennant.webp` | 2:3, 1k | A small heraldic pennant: a long triangular crimson red flag with a thin gold border fluttering to the right from a short dark wooden pole with a small gold finial, painted photoreal, softly lit from the upper right, isolated on a flat pure black background, centred, filling about 70% of the frame, no text, nothing else in the frame. |
