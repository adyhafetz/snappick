export type SasClass =
  | 'metal'
  | 'trash'
  | 'glass'
  | 'paper'
  | 'cardboard'
  | 'plastic'
  | 'biological';

export interface SasPreparationStep {
  stepNumber: number;
  title: string;
  detail: string;
}

export interface SasClassGuide {
  className: SasClass;
  displayName: string;
  malayName: string;
  category: 'Recyclable' | 'Residual Waste';
  isRecyclable: boolean;
  quickSummary: string;
  steps: [SasPreparationStep, SasPreparationStep, SasPreparationStep];
  importantNote: string;
  snapBotSuggestions: string[];
}

export const MALAYSIAN_SAS_GUIDES: Record<SasClass, SasClassGuide> = {
  cardboard: {
    className: 'cardboard',
    displayName: 'Cardboard & Boxes',
    malayName: 'Cardboard',
    category: 'Recyclable',
    isRecyclable: true,
    quickSummary: 'Fold flat, strip tape & keep dry',
    steps: [
      {
        stepNumber: 1,
        title: 'Remove Tape',
        detail: 'Strip heavy adhesive tape and labels.',
      },
      {
        stepNumber: 2,
        title: 'Fold Flat',
        detail: 'Flatten completely to save bin space.',
      },
      {
        stepNumber: 3,
        title: 'Stack & Tie',
        detail: 'Stack neatly and tie into dry bundles.',
      },
    ],
    importantNote: 'Boxes with food stains or cooking oil (e.g. pizza boxes) go to general waste.',
    snapBotSuggestions: [
      'Can I recycle greasy pizza boxes?',
      'Do I need to remove all packaging tape?',
      'What happens if my cardboard got slightly wet?',
    ],
  },

  plastic: {
    className: 'plastic',
    displayName: 'Plastic Bottles & Containers',
    malayName: 'Plastic',
    category: 'Recyclable',
    isRecyclable: true,
    quickSummary: 'Rinse clean, squash flat & separate caps',
    steps: [
      {
        stepNumber: 1,
        title: 'Empty & Rinse',
        detail: 'Rinse out liquids, drinks, and soap residue.',
      },
      {
        stepNumber: 2,
        title: 'Squash Flat',
        detail: 'Crush the bottle firmly to save volume.',
      },
      {
        stepNumber: 3,
        title: 'Separate Caps',
        detail: 'Remove caps and place both into recycling bag.',
      },
    ],
    importantNote: 'Pesticide, motor oil, and toxic chemical bottles are prohibited.',
    snapBotSuggestions: [
      'Should I leave bottle caps on or off?',
      'Can plastic food containers be recycled?',
      'Are thin plastic bags accepted?',
    ],
  },

  metal: {
    className: 'metal',
    displayName: 'Metal Cans & Tins',
    malayName: 'Metal',
    category: 'Recyclable',
    isRecyclable: true,
    quickSummary: 'Rinse clean, crush cans & keep dry',
    steps: [
      {
        stepNumber: 1,
        title: 'Rinse Clean',
        detail: 'Rinse drink cans and food tins clean.',
      },
      {
        stepNumber: 2,
        title: 'Crush Flat',
        detail: 'Flatten drink cans; tuck sharp lids inside.',
      },
      {
        stepNumber: 3,
        title: 'Keep Dry',
        detail: 'Air dry before placing into recycling bag.',
      },
    ],
    importantNote: 'Aerosol spray cans and chemical containers must not be placed in community pickup.',
    snapBotSuggestions: [
      'Can I recycle tin cans with sharp lids?',
      'Are aerosol spray cans recyclable here?',
      'Do I need to peel off the paper labels on cans?',
    ],
  },

  paper: {
    className: 'paper',
    displayName: 'Paper & Newspapers',
    malayName: 'Paper',
    category: 'Recyclable',
    isRecyclable: true,
    quickSummary: 'Keep dry, stack flat & tie',
    steps: [
      {
        stepNumber: 1,
        title: 'Keep Dry',
        detail: 'Store clean and completely away from liquids.',
      },
      {
        stepNumber: 2,
        title: 'Sort Clean',
        detail: 'Discard glossy thermal receipts and soiled paper.',
      },
      {
        stepNumber: 3,
        title: 'Tie Bundles',
        detail: 'Stack newspapers or office paper and tie with string.',
      },
    ],
    importantNote: 'Wet, moldy, or grease-stained paper cannot be recycled by paper mills.',
    snapBotSuggestions: [
      'Can shredded paper be recycled in community pickup?',
      'Are thermal supermarket receipts recyclable?',
      'Do I need to remove staples from paper?',
    ],
  },

  glass: {
    className: 'glass',
    displayName: 'Glass Bottles & Jars',
    malayName: 'Glass',
    category: 'Recyclable',
    isRecyclable: true,
    quickSummary: 'Rinse clean, keep intact — never break',
    steps: [
      {
        stepNumber: 1,
        title: 'Rinse Clean',
        detail: 'Rinse drink bottles and food sauce jars.',
      },
      {
        stepNumber: 2,
        title: 'Remove Lids',
        detail: 'Separate plastic or metal caps from the glass.',
      },
      {
        stepNumber: 3,
        title: 'Keep Intact',
        detail: 'Place upright in sturdy boxes. Never shatter glass.',
      },
    ],
    importantNote: 'Window mirrors, lightbulbs, ceramics, and tempered Pyrex are not accepted.',
    snapBotSuggestions: [
      'What should I do with broken glass?',
      'Can drinking cups and ceramics be recycled with glass?',
      'Should I remove paper labels from glass jars?',
    ],
  },

  biological: {
    className: 'biological',
    displayName: 'Organic & Food Waste',
    malayName: 'Organics',
    category: 'Residual Waste',
    isRecyclable: false,
    quickSummary: 'Drain liquid, compost or seal tightly',
    steps: [
      {
        stepNumber: 1,
        title: 'Drain Liquids',
        detail: 'Drain soups, gravy, and water to prevent odor.',
      },
      {
        stepNumber: 2,
        title: 'Remove Wrappers',
        detail: 'Take off plastic films, toothpicks, and packaging.',
      },
      {
        stepNumber: 3,
        title: 'Compost or Bag',
        detail: 'Compost in garden or tie tightly in garbage bag.',
      },
    ],
    importantNote: 'Food waste is residual waste and must never be mixed into dry recyclables.',
    snapBotSuggestions: [
      'Why cant food waste be placed in the recycling bag?',
      'How can I easily compost vegetable scraps at home?',
      'How to prevent odors from organic waste?',
    ],
  },

  trash: {
    className: 'trash',
    displayName: 'General Residual Waste',
    malayName: 'Residual Waste',
    category: 'Residual Waste',
    isRecyclable: false,
    quickSummary: 'Bag securely for municipal collection',
    steps: [
      {
        stepNumber: 1,
        title: 'Confirm Non-Recyclable',
        detail: 'For dirty wrappers, diapers, and soiled tissues.',
      },
      {
        stepNumber: 2,
        title: 'Tie Bag Securely',
        detail: 'Pack into standard durable garbage bag and tie.',
      },
      {
        stepNumber: 3,
        title: 'Place in Bin',
        detail: 'Place into your scheduled curbside municipal bin.',
      },
    ],
    importantNote: 'Hazardous e-waste, car batteries, and chemicals must go to authorized drop-off depots.',
    snapBotSuggestions: [
      'What belongs in Malaysian residual waste?',
      'Where can I dispose of e-waste and old electronics in Perak?',
      'What is the scheduled 2+1 collection system?',
    ],
  },
};

export function getSasGuide(className: string): SasClassGuide {
  const normalized = className.toLowerCase().trim() as SasClass;
  if (normalized in MALAYSIAN_SAS_GUIDES) {
    return MALAYSIAN_SAS_GUIDES[normalized];
  }
  return MALAYSIAN_SAS_GUIDES.trash;
}

