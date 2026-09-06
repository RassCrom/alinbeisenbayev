/* ---- src/data/projects/*.json (merged by src/data/projects.ts) ---- */

/*
 * These three unions describe what is actually in the JSON. They previously
 * did not: ProjectType listed 'platform' | 'analysis' | 'game', none of which
 * any project uses, while omitting 'animation', which three do — so WorksPage
 * had to reach for String(project.type) to compare against it. ProjectCategory
 * listed five values against eleven in the data. The JSON is read through a
 * cast, so nothing caught the drift.
 */
export type ProjectType = 'website' | 'static-map' | 'animation';
export type ProjectCategory =
  | 'social media'
  | 'print'
  | 'storytelling map'
  | 'interactive map'
  | 'game'
  | 'analysis'
  | 'platform';
export type ProjectStatus = 'complete' | 'in-progress';
export type ConnectionType = 'point' | 'polygon';

export interface GeoOrigin {
  lat: number;
  lng: number;
  label: string;
}

export interface GeoContext {
  connectionType: ConnectionType;
  label: string;
  lat?: number;
  lng?: number;
  geojsonUrl?: string;
  centroidLat?: number;
  centroidLng?: number;
}

export interface Geography {
  origin: GeoOrigin | null;
  contexts: GeoContext[];
}

export interface ProcessStepData {
  step: number;
  title: string;
  description: string;
  image?: string;
}

export interface GalleryImage {
  url: string;
  /**
   * Intrinsic pixel dimensions, recorded from the file itself. Used to reserve
   * space and — in the showcase layout — to render at the image's own aspect
   * ratio instead of cropping it to 16:9. Most of these maps are portrait or
   * square, so the crop was throwing away the composition.
   */
  width?: number;
  height?: number;
  /** High-res download URL (e.g. PNG when url is webp). Falls back to url if omitted. */
  downloadUrl?: string;
  caption: string;
  type: string;
}

export interface VideoItem {
  /** Compressed, faststart MP4 under /videos/<slug>/ */
  url: string;
  /** Poster frame shown until the viewer presses play — the video itself is never fetched before that. */
  poster: string;
  caption: string;
  /** Intrinsic dimensions, used to reserve grid space and avoid layout shift. */
  width: number;
  height: number;
}

/**
 * The source note a printed map carries in its margin — what it was drawn
 * from, in what projection, on what datum. Optional throughout: the detail
 * page derives compiler, software and extent from fields that already exist,
 * and only shows these when they are filled in.
 */
export interface SourceNote {
  /** e.g. "Web Mercator (EPSG:3857)", "Equal Earth", "Lambert Conformal Conic" */
  projection?: string;
  /** e.g. "WGS 84" */
  datum?: string;
  /** Where the data came from, e.g. ["NASA FIRMS", "OpenStreetMap"] */
  sources?: string[];
  /** Anything else worth crediting. */
  note?: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  status: ProjectStatus;
  featured: boolean;
  /**
   * Running order for the landing page's featured strip — 1 first. Set on
   * every featured project; without it a project falls to the end of the
   * strip, since array order here is just alphabetical city-file order and
   * carries no editorial meaning.
   */
  featuredOrder?: number;
  type: ProjectType;
  category: ProjectCategory;
  keywords: string[];
  role: string;
  startDate: string | null;
  endDate: string | null;
  awards: string[];
  coverImage: string;
  context: string;
  idea: string;
  design: string;
  inspiration: string;
  process: ProcessStepData[];
  outcome: string;
  stack: string[];
  liveUrl?: string;
  codeUrl?: string;
  gallery: GalleryImage[];
  videos?: VideoItem[];
  geography: Geography;
  /** Margin source note; see SourceNote. */
  sourceNote?: SourceNote;
  /**
   * Hand nudge for the atlas view: absolute world coordinates (0 to 1) that
   * override the seeded placement on the given axis. Leave unset to let
   * src/atlas/layout.ts place the settlement.
   */
  map?: { x?: number; y?: number };
}

export interface ProjectsData {
  projects: Project[];
}

/* ---- about-story.json ---- */

export type StoryType = 'origin' | 'education' | 'work' | 'award' | 'life' | 'move';

export interface StoryLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface GlobeView {
  lat: number;
  lng: number;
  altitude: number;
  animationDuration: number;
}

export interface StoryPoint {
  id: number;
  type: StoryType;
  date: string;
  title: string;
  description: string;
  location: StoryLocation;
  globeView: GlobeView;
  images: string[];
}

export interface Profile {
  name: string;
  title: string;
  tagline: string;
  languages: string[];
  bio: string;
  photo: string;
}

export interface EndCta {
  heading: string;
  worksLabel: string;
  contactLabel: string;
}

export interface AboutStoryData {
  profile: Profile;
  story: StoryPoint[];
  endCta: EndCta;
}

/* ---- skills.json ---- */

export type SkillLevel = 'expert' | 'advanced' | 'intermediate' | 'beginner' | 'learning';
export type IconType = 'image' | 'text';

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: SkillLevel;
  iconType: IconType;
  iconUrl?: string;
}

export interface SkillsData {
  categories: string[];
  skills: Skill[];
}

/* ---- socials.json ---- */

export interface Social {
  id: string;
  platform: string;
  label: string;
  url: string;
  description: string;
  followers?: string;
  follower_date?: string;
  iconUrl: string;
  featured: boolean;
}

export interface SocialsData {
  socials: Social[];
}

/* ---- blog.json ---- */

export type BlogPostType = 'post' | 'carousel' | 'reels' | 'video';

export interface BlogPost {
  id: string;
  account: string;
  platform: 'youtube' | 'telegram';
  type: BlogPostType;
  title: string;
  text?: string;
  description?: string;
  previewImage?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  url: string;
  date: string;
}

export interface BlogData {
  feeds: {
    youtube: BlogPost[];
    telegram: BlogPost[];
  };
}
