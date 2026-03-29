/**
 * Parses natural language input to extract expense data.
 */
function parseText(input) {
  const normalized = input.toLowerCase();

  // 1. Extract Amount (Looks for numbers, optionally with ₹ or $)
  const amountMatch = normalized.match(/(?:₹|rs\.?|\$)?\s*(\d+(\.\d{1,2})?)\s*(rupees|rs|dollars|bucks)?/i);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  // 2. Extract Date (Handles "today", "yesterday", "X days ago")
  let date = new Date();
  if (normalized.includes('yesterday')) {
      date.setDate(date.getDate() - 1);
  } else if (normalized.match(/(\d+)\s+days?\s+ago/)) {
      const days = parseInt(normalized.match(/(\d+)\s+days?\s+ago/)[1]);
      date.setDate(date.getDate() - days);
  }
  const dateStr = date.toISOString().split('T')[0];
  
  // 3. Extract Category (Smarter: handles "40 cold drink" and "40 on cold drink")
  let category = "General";
  let rawCategory = "";

  const onForMatch = normalized.match(/(?:on|for)\s+(.+)$/);
  if (onForMatch) {
      rawCategory = onForMatch[1].trim();
  } else {
      // Fallback: If no "on/for", take everything after the amount
      const amountPattern = /(?:₹|rs\.?|\$)?\s*\d+(\.\d{1,2})?\s*(rupees|rs|dollars|bucks)?/i;
      const afterAmountMatch = normalized.match(new RegExp(amountPattern.source + "\\s*(.+)$", "i"));
      if (afterAmountMatch) {
          rawCategory = afterAmountMatch[afterAmountMatch.length - 1].trim();
      }
  }

  if (rawCategory) {
      // Clean up common trailing words and conjunctions
      const filterKeywords = ['today', 'yesterday', 'tomorrow', 'now', 'and', '&', 'with', 'for', 'on'];
      const words = rawCategory.split(/\s+/);
      
      // Filter out keywords and empty strings
      let filteredWords = words.filter(word => {
          const w = word.toLowerCase().replace(/[^\w]/g, ''); // remove punctuation for comparison
          return w && !filterKeywords.includes(w);
      });
      
      if (filteredWords.length > 0) {
          category = filteredWords
              .map(word => {
                  // Remove trailing punctuation like commas, periods, etc.
                  const cleaned = word.replace(/[.,!?;:]+$/, '');
                  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
              })
              .filter(w => w.length > 0)
              .join(' ');
      }
  }

  return { amount, category, date: dateStr, description: input.trim() };
}

/**
 * Parses "total" commands to find a time range.
 * Returns: "today", "week", "month", "year", or "all"
 */
function parseSummaryRange(input) {
    const text = input.toLowerCase();
    if (text.includes('today')) return 'today';
    if (text.includes('week')) return 'week';
    if (text.includes('month')) return 'month';
    if (text.includes('year')) return 'year';
    return 'all';
}

module.exports = { parseText, parseSummaryRange };
