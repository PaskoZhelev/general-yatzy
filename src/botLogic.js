import { CATEGORIES, calculateScore } from './gameLogic';

export const getBotAction = (dice, scores, rollsLeft) => {
  const openCategories = CATEGORIES.filter(cat => scores[cat] === undefined);
  
  // 1. If out of rolls, pick the best category
  if (rollsLeft === 0) {
    let bestCategory = null;
    const scoringOptions = [];
    const zeroOptions = [];

    for (const cat of openCategories) {
      const score = calculateScore(dice, cat, scores);
      if (score > 0) {
        scoringOptions.push({ cat, score });
      } else {
        zeroOptions.push({ cat, score });
      }
    }

    if (scoringOptions.length > 0) {
      let maxEval = -Infinity;
      
      for (const option of scoringOptions) {
        let evalScore = option.score;
        
        const upperValues = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
        if (option.cat in upperValues) {
          const faceValue = upperValues[option.cat];
          const count = option.score / faceValue; 
          
          if (count >= 3) evalScore += 15; 
          else evalScore -= 15; 
        }
        
        if ((option.cat === 'smallChance' || option.cat === 'largeChance') && option.score < 20) {
          evalScore -= 5;
        }

        if (evalScore > maxEval) {
          maxEval = evalScore;
          bestCategory = option.cat;
        }
      }
    } else {
      let maxSacrifice = -Infinity;
      for (const option of zeroOptions) {
        const sacValue = getSacrificeValue(option.cat);
        if (sacValue > maxSacrifice) {
          maxSacrifice = sacValue;
          bestCategory = option.cat;
        }
      }
    }

    return { action: 'score', category: bestCategory };
  }

  // 2. Decide which dice to hold
  const counts = Array(7).fill(0);
  dice.forEach(d => counts[d]++);
  
  // Priority 1: General
  const hasGeneral = counts.some(c => c === 5);
  if (hasGeneral && openCategories.includes('general')) return { action: 'hold', holdIndices: [0, 1, 2, 3, 4] };
  
  // Priority 2: Straights
  const sortedStr = [...new Set(dice)].sort().join('');
  if (sortedStr === '12345' && openCategories.includes('smallStraight')) return { action: 'hold', holdIndices: [0, 1, 2, 3, 4] };
  if (sortedStr === '23456' && openCategories.includes('largeStraight')) return { action: 'hold', holdIndices: [0, 1, 2, 3, 4] };

  // Priority 3: Hold Multiples ONLY if they are actually useful for open categories
  let maxCount = 0;
  let mostFrequentDie = 0;
  const upperNames = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  
  for (let i = 1; i <= 6; i++) {
    const canUseMultiple = 
      openCategories.includes(upperNames[i - 1]) ||
      openCategories.includes('threeOfAKind') ||
      openCategories.includes('fourOfAKind') ||
      openCategories.includes('general') ||
      openCategories.includes('onePair') ||
      openCategories.includes('twoPair') ||
      openCategories.includes('fullHouse');

    if (counts[i] >= maxCount && canUseMultiple) {
      maxCount = counts[i];
      mostFrequentDie = i;
    }
  }

  const holdIndices = [];
  if (mostFrequentDie !== 0 && maxCount >= 2) {
    dice.forEach((d, index) => {
      if (d === mostFrequentDie) holdIndices.push(index);
    });
    return { action: 'hold', holdIndices };
  }

  // Priority 4: Late game shift - Try holding for Evens or Odds if multiples are useless
  if (openCategories.includes('even') && !openCategories.includes('odd')) {
    dice.forEach((d, index) => { if (d % 2 === 0) holdIndices.push(index); });
    if (holdIndices.length > 0) return { action: 'hold', holdIndices };
  }
  if (openCategories.includes('odd') && !openCategories.includes('even')) {
    dice.forEach((d, index) => { if (d % 2 !== 0) holdIndices.push(index); });
    if (holdIndices.length > 0) return { action: 'hold', holdIndices };
  }

  // Priority 5: Total garbage roll logic
  let bestSingleDie = -1;
  for (let i = 6; i >= 1; i--) {
    if (counts[i] > 0 && openCategories.includes(upperNames[i - 1])) {
      bestSingleDie = i;
      break;
    }
  }
  
  if (bestSingleDie !== -1) {
    holdIndices.push(dice.indexOf(bestSingleDie)); // Hold highest die that corresponds to an open upper category
  } else {
    const maxDie = Math.max(...dice);
    holdIndices.push(dice.indexOf(maxDie)); // Absolute fallback: just hold the highest number
  }

  return { action: 'hold', holdIndices };
};

const getSacrificeValue = (category) => {
  const sacrificeValues = { 
    general: 50, largeStraight: 45, smallStraight: 40, fullHouse: 35,
    even: 30, odd: 25, fourOfAKind: 20, threeOfAKind: 15,
    twoPair: 10, onePair: 5, ones: 4, twos: 3
  };
  return sacrificeValues[category] || 0;
};