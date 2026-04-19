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

    // SCENARIO A: There is at least one category that gives > 0 points.
    if (scoringOptions.length > 0) {
      let maxEval = -Infinity;
      
      for (const option of scoringOptions) {
        let evalScore = option.score;
        
        // --- NEW UPPER SECTION LOGIC: THE RULE OF 3 ---
        const upperValues = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
        if (option.cat in upperValues) {
          const faceValue = upperValues[option.cat];
          const count = option.score / faceValue; // How many of this die do we actually have?
          
          if (count >= 3) {
            // Good! We are on track for the 63-point bonus. Prioritize this.
            evalScore += 15; 
          } else {
            // Bad! Scoring less than 3 jeopardizes the bonus. 
            // Penalize this option so the bot looks for an escape in the Lower Section.
            evalScore -= 15; 
          }
        }
        
        // Try to save Chance for when it really needs it
        if ((option.cat === 'smallChance' || option.cat === 'largeChance') && option.score < 20) {
          evalScore -= 5;
        }

        if (evalScore > maxEval) {
          maxEval = evalScore;
          bestCategory = option.cat;
        }
      }
    } 
    // SCENARIO B: Absolutely every available category results in 0 points.
    else {
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
  
  // Priority 1: If we have a General, hold all
  const hasGeneral = counts.some(c => c === 5);
  if (hasGeneral && openCategories.includes('general')) return { action: 'hold', holdIndices: [0, 1, 2, 3, 4] };
  
  // Priority 2: Hold Straights if we have them and need them
  const sortedStr = [...new Set(dice)].sort().join('');
  if (sortedStr === '12345' && openCategories.includes('smallStraight')) return { action: 'hold', holdIndices: [0, 1, 2, 3, 4] };
  if (sortedStr === '23456' && openCategories.includes('largeStraight')) return { action: 'hold', holdIndices: [0, 1, 2, 3, 4] };

  // Priority 3: Hold the most frequent die to build multiples
  let maxCount = 0;
  let mostFrequentDie = 0;
  
  for (let i = 1; i <= 6; i++) {
    if (counts[i] >= maxCount) {
      maxCount = counts[i];
      mostFrequentDie = i;
    }
  }

  const holdIndices = [];
  dice.forEach((d, index) => {
    if (d === mostFrequentDie && maxCount >= 2) holdIndices.push(index);
  });

  // Priority 4: If we have a total garbage roll (no pairs at all), hold the single highest die
  if (holdIndices.length === 0) {
    const maxDie = Math.max(...dice);
    const indexToHold = dice.indexOf(maxDie);
    holdIndices.push(indexToHold);
  }

  return { action: 'hold', holdIndices };
};

const getSacrificeValue = (category) => {
  const sacrificeValues = { 
    general: 50, 
    largeStraight: 45, 
    smallStraight: 40, 
    fullHouse: 35,
    even: 30,
    odd: 25,
    fourOfAKind: 20,
    threeOfAKind: 15,
    twoPair: 10,
    onePair: 5,
    ones: 4,
    twos: 3
  };
  return sacrificeValues[category] || 0;
};