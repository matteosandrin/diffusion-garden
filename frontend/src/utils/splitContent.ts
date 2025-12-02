/**
 * Split content into logical sub-components using pattern detection.
 * Tries patterns in order of specificity, returns first that produces 2+ items.
 */
export function splitContent(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. Numbered lists: "1. ", "1) ", "a. ", "a) "
  const numberedListRegex = /^(?:\d+[.)]\s|[a-zA-Z][.)]\s)/;
  const lines = trimmed.split('\n');
  const numberedItems: string[] = [];
  let currentItem = '';
  
  for (const line of lines) {
    if (numberedListRegex.test(line.trimStart())) {
      if (currentItem.trim()) {
        numberedItems.push(currentItem.trim());
      }
      // Remove the list marker
      currentItem = line.trimStart().replace(/^(?:\d+[.)]\s|[a-zA-Z][.)]\s)/, '');
    } else if (currentItem) {
      // Continuation of current item
      currentItem += '\n' + line;
    }
  }
  if (currentItem.trim()) {
    numberedItems.push(currentItem.trim());
  }
  if (numberedItems.length >= 2) {
    return numberedItems;
  }

  // 2. Bullet points: -, *, •, ◦ at line start
  const bulletRegex = /^[-*•◦]\s+/;
  const bulletItems: string[] = [];
  currentItem = '';
  
  for (const line of lines) {
    if (bulletRegex.test(line.trimStart())) {
      if (currentItem.trim()) {
        bulletItems.push(currentItem.trim());
      }
      currentItem = line.trimStart().replace(bulletRegex, '');
    } else if (currentItem) {
      currentItem += '\n' + line;
    }
  }
  if (currentItem.trim()) {
    bulletItems.push(currentItem.trim());
  }
  if (bulletItems.length >= 2) {
    return bulletItems;
  }

  // 3. Markdown headers: lines starting with #
  const headerRegex = /^#+\s+/;
  const headerSections: string[] = [];
  let currentSection = '';
  
  for (const line of lines) {
    if (headerRegex.test(line)) {
      if (currentSection.trim()) {
        headerSections.push(currentSection.trim());
      }
      currentSection = line;
    } else {
      currentSection += '\n' + line;
    }
  }
  if (currentSection.trim()) {
    headerSections.push(currentSection.trim());
  }
  if (headerSections.length >= 2) {
    return headerSections;
  }

  // 4. Paragraphs: double newlines
  const paragraphs = trimmed.split(/\n\s*\n/).map(p => p.trim()).filter(p => p);
  if (paragraphs.length >= 2) {
    return paragraphs;
  }

  // 5. Fallback: single newlines
  const lineItems = lines.map(l => l.trim()).filter(l => l);
  if (lineItems.length >= 2) {
    return lineItems;
  }

  // No split possible
  return [];
}

