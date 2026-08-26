import { CATEGORIES, calculateScore } from './gameLogic';

export const getBotAction = (dice, scores, rollsLeft) => {
  const openCategories = CATEGORIES.filter(cat => scores[cat] === undefined);
  
  // 1. If out of rolls, pick the best category
  if (rollsLeft === 0) {
    let bestCategory = null;
    const goodOptions = [];
    const weakUpperOptions = [];
    const zeroOptions = [];
    const upperValues = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
    const upperNames = Object.keys(upperValues);
    // Points already banked in the upper section from categories filled so far.
    const currentUpperSum = upperNames.reduce((sum, name) => sum + (scores[name] || 0), 0);

    for (const cat of openCategories) {
      const score = calculateScore(dice, cat, scores);

      if (score === 0) {
        zeroOptions.push({ cat });
        continue;
      }

      if (cat in upperValues) {
        const faceValue = upperValues[cat];
        const count = score / faceValue;

        // A surplus banked from other upper categories (e.g. 4 sixes instead of 3)
        // can offset a below-pace score here. Only treat this as "weak" if the
        // 63 bonus is still out of reach even assuming baseline (3-per-face) results
        // from the remaining open upper categories.
        const baselineForOthers = upperNames
          .filter(name => name !== cat && openCategories.includes(name))
          .reduce((sum, name) => sum + 3 * upperValues[name], 0);
        const projectedUpperSum = currentUpperSum + score + baselineForOthers;

        if (count < 3 && projectedUpperSum < 63) {
          weakUpperOptions.push({ cat, score });
          continue;
        }
        goodOptions.push({ cat, score: score + 15 });
        continue;
      }

      let evalScore = score;
      if ((cat === 'smallChance' || cat === 'largeChance') && score < 20) {
        evalScore -= 5;
      }
      goodOptions.push({ cat, score: evalScore });
    }

    if (goodOptions.length > 0) {
      let maxEval = -Infinity;
      for (const option of goodOptions) {
        if (option.score > maxEval) {
          maxEval = option.score;
          bestCategory = option.cat;
        }
      }
    } else if (weakUpperOptions.length > 0 && zeroOptions.length > 0) {
      // Sacrifice an already-dead category this turn so the weak upper category
      // stays open for a future chance at 3+ of a kind.
      let maxSacrifice = -Infinity;
      for (const option of zeroOptions) {
        const sacValue = getSacrificeValue(option.cat);
        if (sacValue > maxSacrifice) {
          maxSacrifice = sacValue;
          bestCategory = option.cat;
        }
      }
    } else if (weakUpperOptions.length > 0) {
      let maxScore = -Infinity;
      for (const option of weakUpperOptions) {
        if (option.score > maxScore) {
          maxScore = option.score;
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
  const upperNames = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];

  // Priority 1: General is the most valuable roll possible - lock it in right away
  // instead of burning remaining rolls. If General itself is already filled, use
  // this roll as a joker for whichever straight is open and worth more.
  const hasGeneral = counts.some(c => c === 5);
  if (hasGeneral) {
    if (openCategories.includes('general')) return { action: 'score', category: 'general' };
    if (openCategories.includes('largeStraight')) return { action: 'score', category: 'largeStraight' };
    if (openCategories.includes('smallStraight')) return { action: 'score', category: 'smallStraight' };
  }

  // Priority 2: An exact Straight already scores the category's max - lock it in
  // immediately rather than rerolling dice that can't improve the result.
  const sortedStr = [...new Set(dice)].sort().join('');
  if (sortedStr === '12345' && openCategories.includes('smallStraight')) return { action: 'score', category: 'smallStraight' };
  if (sortedStr === '23456' && openCategories.includes('largeStraight')) return { action: 'score', category: 'largeStraight' };

  // An exact Full House (3+2, or a General used as a joker) is already made.
  // Only lock it in immediately if it's a solid score - a weak one (e.g. three
  // 1s and a pair of 2s) is still worth risking a reroll for something better,
  // since there's still a roll left to try.
  const fullHouseSum = dice.reduce((a, b) => a + b, 0);
  if (openCategories.includes('fullHouse') && (hasGeneral || (counts.includes(3) && counts.includes(2))) && fullHouseSum >= 20) {
    return { action: 'score', category: 'fullHouse' };
  }

  // Priority 3: Compare holding a multiple, holding towards Even/Odd, or holding
  // towards an incomplete Straight, and go with whichever scores best. The upper
  // section (getting to 63) stays the main focus while it's incomplete, so a
  // multiple that still needs its upper category gets a strong bonus; Even/Odd
  // only get their bonus once the upper section is fully done.
  let bestIndices = [];
  let bestScore = 0;

  const multipleCategoryOpen = ['general', 'fourOfAKind', 'threeOfAKind', 'fullHouse', 'twoPair', 'onePair']
    .some(cat => openCategories.includes(cat));
  const upperComplete = upperNames.every(name => !openCategories.includes(name));

  for (let i = 1; i <= 6; i++) {
    if (counts[i] < 2) continue;
    let score = counts[i] * 10;
    if (openCategories.includes(upperNames[i - 1])) score += 25;
    if (multipleCategoryOpen) score += 3;

    // Use >= so that among equal-count multiples (e.g. a pair of 4s vs a pair
    // of 5s), the higher face value wins the tie - it's worth strictly more
    // for General/of-a-kind categories and for the upper section itself.
    if (score >= bestScore) {
      bestScore = score;
      bestIndices = dice.map((d, idx) => d === i ? idx : -1).filter(idx => idx !== -1);
    }
  }

  // Chasing an open Full House works best by holding BOTH paired values at once
  // (e.g. two 4s and two 6s), not just the single biggest group, since either
  // pair completing into a triple finishes the category. Like Even/Odd, this
  // only gets its full weight once the upper section is done, so it doesn't
  // casually outweigh a pair that's still building toward the 63 bonus.
  if (openCategories.includes('fullHouse')) {
    const pairedFaces = [];
    for (let i = 1; i <= 6; i++) if (counts[i] >= 2) pairedFaces.push(i);
    if (pairedFaces.length >= 2) {
      const indices = dice.map((d, i) => pairedFaces.includes(d) ? i : -1).filter(i => i !== -1);
      let score = indices.length * 10;
      if (upperComplete) score += 15;
      if (score > bestScore) {
        bestScore = score;
        bestIndices = indices;
      }
    }
  }

  if (openCategories.includes('even')) {
    const evenIndices = dice.map((d, i) => d % 2 === 0 ? i : -1).filter(i => i !== -1);
    let score = evenIndices.length * 10;
    if (upperComplete) score += 15;
    if (evenIndices.length >= 2 && score > bestScore) {
      bestScore = score;
      bestIndices = evenIndices;
    }
  }
  if (openCategories.includes('odd')) {
    const oddIndices = dice.map((d, i) => d % 2 !== 0 ? i : -1).filter(i => i !== -1);
    let score = oddIndices.length * 10;
    if (upperComplete) score += 15;
    if (oddIndices.length >= 2 && score > bestScore) {
      bestScore = score;
      bestIndices = oddIndices;
    }
  }

  // Chasing an open Straight only needs one die per required number - duplicates
  // are dead weight that should be rerolled instead of held, since they can never
  // help complete the missing number(s). Like Even/Odd, this only gets its full
  // weight once the upper section is done, so the upper section stays the main
  // focus while it's still incomplete.
  const straightTargets = { smallStraight: [1, 2, 3, 4, 5], largeStraight: [2, 3, 4, 5, 6] };
  for (const cat of Object.keys(straightTargets)) {
    if (!openCategories.includes(cat)) continue;
    const usedIndices = new Set();
    const indices = [];
    for (const value of straightTargets[cat]) {
      const idx = dice.findIndex((d, i) => d === value && !usedIndices.has(i));
      if (idx !== -1) {
        usedIndices.add(idx);
        indices.push(idx);
      }
    }
    let score = indices.length * 10;
    if (upperComplete) score += 15;
    if (indices.length > 0 && score > bestScore) {
      bestScore = score;
      bestIndices = indices;
    }
  }

  if (bestIndices.length > 0) {
    return { action: 'hold', holdIndices: bestIndices };
  }

  // Priority 4: Total garbage roll logic
  const holdIndices = [];
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
    // General has the biggest possible payoff (up to 100 pts), so it's the last
    // thing to give up on - only zero it out when there's truly no other option.
    general: -1000,
    fourOfAKind: 45, smallStraight: 40, largeStraight: 35,
    even: 30, odd: 25, fullHouse: 20, threeOfAKind: 15,
    twoPair: 10, onePair: 5, ones: 4, twos: 3
  };
  return sacrificeValues[category] || 0;
};