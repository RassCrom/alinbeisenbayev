/* ---- projects.json ---- */

export type ProjectType = 'website' | 'static-map' | 'platform' | 'analysis' | 'game';
export type ProjectCategory = 'interactive-map' | 'print' | 'platform' | 'analysis' | 'game';
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
  origin: GeoOrigin;
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
  caption: string;
  type: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  status: ProjectStatus;
  featured: boolean;
  type: ProjectType;
  category: ProjectCategory;
  keywords: string[];
  role: string;
  startDate: string;
  endDate: string;
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
  geography: Geography;
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

export type SkillLevel = 'expert' | 'advanced' | 'intermediate' | 'learning';
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
  platform: 'instagram' | 'linkedin' | 'youtube';
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
    instagram_tulparmaps: BlogPost[];
    instagram_tulparstories: BlogPost[];
    linkedin: BlogPost[];
    youtube_tulparstories: BlogPost[];
  };
}
