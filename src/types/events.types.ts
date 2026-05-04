export interface UmbracoEvent {
  id: string;
  eventId: string;
  lastUpdatedDate: string;
  name: string;
}

export interface CrmEvent {
  title: string;
  featuredImage: string;
  pageContent: string;
  imagesCarousel: string;
  startDate: string;
  endDate: string;
  location: string | null;
  eventAudiences: string | null;
  eventSectors: string[];
  eventId: number;
  eventType: string;
  eventVenues: string[];
  eventOrganiser: string;
  websiteURL: string | null;
  dWTCEvent: boolean;
  eventLogo: string | null;
  socialMedia: {
    facebook: string;
    linkedIn: string;
    instagram: string;
    youtube: string;
    tiktok: string;
  };
  lastUpdatedDate: string;
  WebsiteStatus: string;
}

export interface Env {
  CRM_API_URL: string;
  OCP_APIM_SUBSCRIPTION_KEY: string;
  UMBRACO_PROJECT_ALIAS: string;
  API_KEY: string;
  UMBRACO_PARENT_ID: string;
  UMBRACO_BASE_URL: string;
  MAILGUN_API_KEY: string;
  MAILGUN_API_BASE_URL: string;
  NOTIFICATION_EMAIL: string;
  NOTIFICATION_FROM_EMAIL: string;
  CLOUDFLARE_WEBHOOK: string;
  CRON_LOCK: KVNamespace;
}

// Response types
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type ServiceResponse<T> = SuccessResponse<T> | ErrorResponse;

// Umbraco Content API types
export interface LocalizedField<T = string> {
  "en-US": T;
  ar: T;
}

export interface InvariantField<T = string> {
  $invariant: T;
}

export interface CreateEventRequest {
  name: LocalizedField;
  contentTypeAlias: string;
  title: LocalizedField;
  description: LocalizedField;
  location?: LocalizedField<string | null>;
  eventOrganiser: LocalizedField;
  websiteURL: LocalizedField<string | null>;
  eventId: InvariantField<number>;
  lastUpdatedDate: InvariantField;
  facebook: LocalizedField<string | null>;
  linkedIn: LocalizedField<string | null>;
  twitter: LocalizedField<string | null>;
  instagram: LocalizedField<string | null>;
  youtube: LocalizedField<string | null>;
  tiktok: LocalizedField<string | null>;
  parentId: string;
  startDate: InvariantField;
  endDate: InvariantField;
  dWTCEvent: InvariantField<boolean>;
  eventType: InvariantField;
  eventVenues: InvariantField<string[] | null>;
}

export interface UmbracoContentResponse {
  _createDate: string;
  _id: string;
  _hasChildren: boolean;
  _level: number;
  parentId: string;
  sortOrder: number;
  contentTypeAlias: string;
  _currentVersionState: LocalizedField;
  name: LocalizedField;
  _updateDate: LocalizedField;
  rel: string;
  _links: {
    self: { href: string };
    root: { href: string; title: string };
    children: { href: string; title: string };
    publish: { href: string; title: string };
    unpublish: { href: string; title: string };
    contenttype: { href: string; title: string };
    parent: { href: string; title: string };
  };
  [key: string]: any;
}
