export interface ServiceItem {
  id: string;
  icon: string;
  title: string;
  sub: string;
  pts: string[];
}

export const SERVICES: ServiceItem[] = [
  {
    id: "flatwork",
    icon: "ti-road",
    title: "Concrete Flatwork",
    sub: "Driveways, patios, sidewalks, slabs, and parking lots — poured and finished with precision.",
    pts: ["Driveways & parking lots", "Patios & pool decks", "Sidewalks & walkways", "Commercial & industrial slabs", "Shop floors & garage slabs", "Post-frame building pads"],
  },
  {
    id: "stamped",
    icon: "ti-palette",
    title: "Stamped & Decorative Concrete",
    sub: "Stamped patterns, color stains, and decorative finishes that make your concrete stand out.",
    pts: ["Stamped patios & driveways", "Stone, brick & wood patterns", "Color stains & dyes", "Exposed aggregate", "Saw-cut designs", "Pool surrounds & outdoor living"],
  },
  {
    id: "masonry",
    icon: "ti-wall",
    title: "Masonry Services",
    sub: "Block walls, retaining walls, columns, steps, and custom stonework built to last.",
    pts: ["Block foundations & stem walls", "Retaining walls", "Decorative columns & pillars", "Steps & staircases", "Outdoor kitchens & fireplaces", "Landscape walls"],
  },
  {
    id: "polebarn",
    icon: "ti-building-warehouse",
    title: "Pole Barn / Post-Frame",
    sub: "Workshops, barns, equipment sheds, and agricultural buildings across Middle Georgia.",
    pts: ["Equipment & machinery storage", "Horse barns & agricultural buildings", "Workshops & garages", "Hay storage & farm buildings", "Commercial storage buildings", "Concrete slab or pier foundations"],
  },
  {
    id: "foundations",
    icon: "ti-building-fortress",
    title: "Block Foundations & Columns",
    sub: "Block stem walls, crawl space foundations, and structural or decorative columns.",
    pts: ["Block stem walls", "Crawl space perimeter foundations", "Poured concrete footings", "Structural & decorative columns", "Footing excavation & forming", "Residential & commercial"],
  },
];
