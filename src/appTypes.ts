export type PublicPage = "home" | "services" | "gallery" | "about" | "contact" | "estimate";

export interface PublicPageProps {
  setPage: (page: PublicPage) => void;
}
