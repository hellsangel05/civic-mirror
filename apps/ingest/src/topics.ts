// Fixed topic taxonomy used for tagging measures and scoring alignment.
// Keep this list short and stable — every new topic is a UI column and a
// prompt engineering cost. Expand only when a real measure genuinely doesn't
// fit any existing topic.

export const TOPIC_SLUGS = [
  "housing",
  "homelessness",
  "public-safety",
  "criminal-justice",
  "education",
  "transit",
  "climate",
  "healthcare",
  "taxes",
  "civil-rights",
  "government-reform",
  "economy",
] as const;

export type TopicSlug = (typeof TOPIC_SLUGS)[number];

export const TOPIC_DESCRIPTIONS: Record<TopicSlug, string> = {
  housing: "Availability and affordability of housing; tenant protections; new housing construction.",
  homelessness: "Services, shelters, and prevention programs for people experiencing homelessness.",
  "public-safety": "Policing, emergency response, and general community safety.",
  "criminal-justice": "Courts, incarceration, sentencing, and rights of the accused or formerly incarcerated.",
  education: "Public schools, teachers, curriculum, school funding, early childhood, higher ed.",
  transit: "Public transportation, roads, bike/pedestrian infrastructure, congestion.",
  climate: "Climate change, air and water quality, renewable energy, environmental protection.",
  healthcare: "Access to medical care, mental health services, substance-use treatment, public health.",
  taxes: "Tax rates, tax fairness, and how public money is raised.",
  "civil-rights": "Voting rights, equal protection, non-discrimination, immigrant rights.",
  "government-reform": "Transparency, ethics, accountability, structure of local government.",
  economy: "Jobs, wages, small business support, cost of living, general economic opportunity.",
};
