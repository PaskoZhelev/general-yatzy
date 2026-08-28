export const CATEGORIES = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
  'onePair', 'twoPair', 'threeOfAKind', 'fourOfAKind', 'fullHouse',
  'even', 'odd', 'smallStraight', 'largeStraight', 'general', 'smallChance', 'largeChance'
];

export const CATEGORY_NAMES = {
  ones: '1s', twos: '2s', threes: '3s', fours: '4s', fives: '5s', sixes: '6s',
  onePair: '2', twoPair: '2+2', threeOfAKind: '3',
  fourOfAKind: '4', fullHouse: '3+2', 
  even: 'Even', odd: 'Odd', smallStraight: 'Small Straight', largeStraight: 'Large Straight', 
  general: 'General', smallChance: 'Small Chance', largeChance: 'Large Chance'
};

export const calculateScore = (dice, category, currentScores = {}) => {
  if (dice.length === 0) return 0;
  
  const counts = Array(7).fill(0);
  const sum = dice.reduce((a, b) => a + b, 0);
  dice.forEach(d => counts[d]++);
  
  const isGeneral = counts.some(c => c === 5);

  switch (category) {
    case 'ones': return counts[1] * 1;
    case 'twos': return counts[2] * 2;
    case 'threes': return counts[3] * 3;
    case 'fours': return counts[4] * 4;
    case 'fives': return counts[5] * 5;
    case 'sixes': return counts[6] * 6;
    
    case 'onePair':
      for (let i = 6; i >= 1; i--) if (counts[i] >= 2) return i * 2;
      return 0;
      
    case 'twoPair': {
      let pairs = 0, score = 0;
      for (let i = 6; i >= 1; i--) {
        if (counts[i] >= 2) { 
          pairs++; 
          score += i * 2; 
        }
      }
      // Strictly requires 2 distinct pairs. (4-of-a-kind will only count as 1 pair and return 0)
      return pairs === 2 ? score : 0;
    }
    
    case 'threeOfAKind':
      for (let i = 6; i >= 1; i--) if (counts[i] >= 3) return i * 3;
      return 0;
      
    case 'fourOfAKind':
      for (let i = 6; i >= 1; i--) if (counts[i] >= 4) return i * 4;
      return 0;
      
    case 'fullHouse':
      if (counts.includes(3) && counts.includes(2)) return sum;
      if (isGeneral) return sum; 
      return 0;
      
    case 'even':
      return dice.every(d => d % 2 === 0) ? sum : 0;
      
    case 'odd':
      return dice.every(d => d % 2 !== 0) ? sum : 0;
      
    case 'smallStraight': {
      if (isGeneral) return 30;
      const sorted = [...new Set(dice)].sort().join('');
      return sorted === '12345' ? 30 : 0;
    }
    
    case 'largeStraight': {
      if (isGeneral) return 40;
      const sorted = [...new Set(dice)].sort().join('');
      return sorted === '23456' ? 40 : 0;
    }
    
    case 'general':
      for (let i = 1; i <= 6; i++) if (counts[i] === 5) return (i * 10) + 40;
      return 0;
      
    case 'smallChance': {
      if (currentScores.largeChance !== undefined && sum > currentScores.largeChance) return 0;
      return sum;
    }
    
    case 'largeChance': {
      if (currentScores.smallChance !== undefined && sum < currentScores.smallChance) return 0;
      return sum;
    }
    default: return 0;
  }
};

export const calculateUpperTotal = (scores) => {
  const upperKeys = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  const sum = upperKeys.reduce((acc, key) => acc + (scores[key] || 0), 0);
  return { sum, bonus: sum >= 63 ? 50 : 0 };
};