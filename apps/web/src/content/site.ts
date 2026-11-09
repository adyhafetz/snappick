// Editable site content. It mirrors what the Android app does (see PRODUCT.md and the screens in apps/mobile).

export interface NewsArticle {
  id: string;
  source: string;
  category: string;
  title: string;
  summary: string;
  publishedDate: string;
  imageUrl: string;
  url: string;
}

// The same Perak recycling news list as the app's Home tab (apps/mobile/src/lib/news/perakNews.ts), latest first.
// It is a curated list, not a live feed: keep it in sync with the app when articles are added.
export const PERAK_ECO_NEWS: NewsArticle[] = [
  {
    id: 'thestar-ipoh-trash4food-drive',
    source: 'The Star',
    category: 'Community Recycling',
    title: 'Recycling drive brings grocery relief to Ipoh folk',
    summary: 'Trash4Food campaigns at Kinta Heights let residents trade household recyclables directly for essential groceries.',
    publishedDate: 'Sep 2026',
    imageUrl: 'https://apicms.thestar.com.my/uploads/images/2026/09/25/4127987.jpeg',
    url: 'https://www.thestar.com.my/metro/metro-news/2026/09/25/recycling-drive-brings-grocery-relief-to-ipoh-folk',
  },
  {
    id: 'thestar-gof-ewaste-crackdown',
    source: 'The Star',
    category: 'Hazardous Waste',
    title: 'GOF seizes RM9.3mil worth of illegal e-waste in Ipoh',
    summary: 'Authorities raid unlicensed electronic waste processing sites in Perak to protect the environment from toxic residue.',
    publishedDate: 'Aug 2026',
    imageUrl: 'https://apicms.thestar.com.my/uploads/images/2026/08/05/4044202.jpg',
    url: 'https://www.thestar.com.my/news/nation/2026/08/05/gof-seizes-rm93mil-worth-of-illegal-e-waste-14-nabbed-in-integrated-ops-in-ipoh',
  },
  {
    id: 'thestar-ipoh-clothing-recycling',
    source: 'The Star',
    category: 'Textile Waste',
    title: 'Ipoh collects over 53,000kg of used clothing for recycling',
    summary: 'City council expands dedicated fabric drop-off points with Shell and Life Line to keep textiles out of landfills.',
    publishedDate: 'Nov 2025',
    imageUrl: 'https://apicms.thestar.com.my/uploads/images/2025/11/01/3600434.jpeg',
    url: 'https://www.thestar.com.my/news/nation/2025/11/01/ipoh-collects-over-53000kg-of-used-clothing-for-recycling',
  },
];

export const FAQ: { q: string; a: string }[] = [
  { q: 'Is SnapPick an official collection scheme?', a: 'No. It is a community pilot for Perak. It is not an official municipal or statutory collection scheme.' },
  { q: 'Which phones does it work on?', a: 'Android phones. The app is installed directly from the Download page.' },
  { q: 'Where can I request a pickup?', a: 'Inside the 13 districts of Perak. You place a pin on the map and the app checks the district for you.' },
  { q: 'What can the scanner recognise?', a: 'Plastic, paper, cardboard, metal, glass, general waste and food waste. Batteries, bulbs, chemicals and electronics are declared by you, never guessed by the app.' },
  { q: 'Who can see where I live?', a: 'Only the collector who accepts your request sees your exact meeting spot. Everyone else sees an approximate spot snapped to a grid roughly a kilometre wide.' },
  { q: 'Does it work without internet?', a: 'Scanning runs on your phone, so it works offline. Scans are saved and uploaded when you reconnect.' },
  { q: 'Can I be both a resident and a collector?', a: 'Yes. Any account can request pickups and claim them. Collectors are the only people who get rated.' },
  { q: 'How many jobs can a collector hold?', a: 'Up to three active jobs at a time.' },
  {
    q: 'Can I delete my data?',
    a: 'Yes. In Profile, Delete Account first removes the scan and proof photos you uploaded, then your account, personal info, addresses and saved scans. Your open requests are cancelled and pickups you were collecting go back to the map. Anonymised images already used in past AI training sets cannot be removed one by one.',
  },
];
