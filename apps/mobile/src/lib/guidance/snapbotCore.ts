export function getLocalRecyclingFallback(query: string, itemContext?: string): string {
  const lower = query.toLowerCase();

  if (lower.includes('pizza') || lower.includes('oil') || lower.includes('greas') || lower.includes('minyak')) {
    return 'Pizza boxes or cardboard soaked in cooking oil or grease cannot be recycled because grease damages paper mill fibers. Tear off clean lid portions for recycling, and put greasy bottoms in regular trash.';
  }

  if (lower.includes('cap') || lower.includes('lid') || lower.includes('tutup')) {
    return 'For plastic bottles: unscrew the cap, rinse out residual liquid, squash the bottle flat, and place both in the recycling bag. Compressing saves crucial bin space!';
  }

  if (lower.includes('rinse') || lower.includes('clean') || lower.includes('basuh') || lower.includes('cuci')) {
    return 'Yes, a quick rinse is essential! Emptying and rinsing containers stops foul odors, prevents pests, and avoids contaminating clean paper batches.';
  }

  if (lower.includes('receipt') || lower.includes('resit')) {
    return 'Thermal cash receipts contain chemical coatings (BPA) and belong in general trash. Clean office paper, flyers, and magazines are recyclable.';
  }

  if (lower.includes('battery') || lower.includes('e-waste') || lower.includes('bateri') || lower.includes('bulb') || lower.includes('lampu')) {
    return '⚠️ Batteries, bulbs, and e-waste are hazardous materials. Never put them in household recyclables or community pickup! Drop them off at designated e-waste bins or municipal collection depots.';
  }

  if (itemContext) {
    return `For ${itemContext}: ensure the item is emptied, rinsed clean, dried, and flattened/compacted to save collection space!`;
  }

  return 'Always ensure your recyclables are clean, dry, and flattened to save space. Keep hazardous waste like batteries and e-waste separate. What specific item can I help you sort?';
}
