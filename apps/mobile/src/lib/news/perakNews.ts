export interface PerakNewsArticle {
  id: string;
  source: string;
  category: string;
  title: string;
  summary: string;
  publishedDate: string;
  imageUrl: string;
  url: string;
}

// Sorted latest first
export const PERAK_ECO_NEWS: PerakNewsArticle[] = [
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
