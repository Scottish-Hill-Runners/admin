export type RaceImageLicense = {
  id: string;
  name: string;
  description: string;
  url: string | null;
};

export const RACE_IMAGE_LICENSE_IDS = [
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "CC-BY-NC-4.0",
  "CC-BY-NC-SA-4.0",
  "CC0-1.0",
  "FAL-1.3",
  "LicenseRef-Permission",
] as const;

export type RaceImageLicenseId = (typeof RACE_IMAGE_LICENSE_IDS)[number];

export const RACE_IMAGE_LICENSES: readonly RaceImageLicense[] = [
  {
    id: "CC-BY-4.0",
    name: "CC Attribution 4.0",
    description: "Free to share and adapt with credit to the photographer.",
    url: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "CC-BY-SA-4.0",
    name: "CC Attribution-ShareAlike 4.0",
    description:
      "Free to share and adapt with credit; any adaptations must carry the same licence.",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  {
    id: "CC-BY-NC-4.0",
    name: "CC Attribution-NonCommercial 4.0",
    description: "Free to share and adapt with credit; not for commercial use.",
    url: "https://creativecommons.org/licenses/by-nc/4.0/",
  },
  {
    id: "CC-BY-NC-SA-4.0",
    name: "CC Attribution-NonCommercial-ShareAlike 4.0",
    description:
      "Share and adapt with credit; no commercial use; adaptations must carry the same licence.",
    url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  },
  {
    id: "CC0-1.0",
    name: "Public Domain (CC0 1.0)",
    description: "No rights reserved; donated to the public domain.",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  {
    id: "FAL-1.3",
    name: "Free Art Licence 1.3",
    description: "Copyleft licence for artistic works.",
    url: "https://artlibre.org/licence/lal/en/",
  },
  {
    id: "LicenseRef-Permission",
    name: "Used by permission",
    description:
      "All rights reserved. The rights holder has given explicit permission to use this image on the SHR website.",
    url: null,
  },
];
