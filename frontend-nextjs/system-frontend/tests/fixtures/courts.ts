import type { Court } from "../../app/types/court";

export const courts: Court[] = [
  {
    id: "indoor-premium",
    name: "Indoor Premium Court",
    description: "A bright, climate-controlled court made for all-day play.",
    category: "Indoor",
    pricePerHour: 400,
    location: "Makati City",
    amenities: ["Air-conditioned", "Equipment rental", "Changing rooms"],
    operatingHours: "Daily, 6:00 AM - 10:00 PM",
    openingTime: "06:00",
    closingTime: "22:00",
    artwork: "indoor",
    image: "/img/indoor-1.png",
    available: true,
  },
];
