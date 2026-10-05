import { CATEGORIES, calculateScore } from './gameLogic';

const SAVE_KEY = 'general-yatzy-save';
export const NO_DICE = [false, false, false, false, false];
const DEFAULT_ORDER = [0, 1, 2, 3, 4];

export const randomDice = () => Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);

export const newGameId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const isGameOver = (scores) =>
  CATEGORIES.every(cat => scores.player[cat] !== undefined && scores.bot[cat] !== undefined);

const freshTurn = {
  dice: [1, 1, 1, 1, 1],
  held: NO_DICE,
  rolling: NO_DICE,
  diceOrder: DEFAULT_ORDER,
  rollsLeft: 3,
};

export const initialState = {
  ...freshTurn,
  turn: 'player',
  scores: { player: {}, bot: {} },
  message: 'Your turn! Roll the dice.',
  history: [],
  nextHistoryId: 1,
};

const playerRollMessage = (rollsLeft) =>
  rollsLeft > 0
    ? `Hold dice or pick a category (${rollsLeft} ${rollsLeft === 1 ? 'roll' : 'rolls'} left).`
    : 'Pick a category to score.';

export const gameReducer = (state, action) => {
  const over = isGameOver(state.scores);

  switch (action.type) {
    case 'ROLL': {
      if (action.player !== state.turn || state.rollsLeft === 0 || over) return state;
      const { held } = state;
      const rollsLeft = state.rollsLeft - 1;
      return {
        ...state,
        rollsLeft,
        dice: state.dice.map((d, i) => (held[i] ? d : action.values[i])),
        rolling: held.map(h => !h),
        // Held dice only shift to the front once a new roll happens, not on click
        diceOrder: [...DEFAULT_ORDER].sort((a, b) => (held[b] ? 1 : 0) - (held[a] ? 1 : 0)),
        message: state.turn === 'player' ? playerRollMessage(rollsLeft) : state.message,
      };
    }

    case 'ROLL_ANIMATION_END':
      return { ...state, rolling: NO_DICE };

    case 'TOGGLE_HOLD': {
      if (state.turn !== 'player' || state.rollsLeft === 3 || state.rollsLeft === 0 || over) return state;
      const held = [...state.held];
      held[action.index] = !held[action.index];
      return { ...state, held };
    }

    case 'BOT_HOLD':
      if (state.turn !== 'bot' || over) return state;
      return { ...state, held: action.held, message: 'Bot holds dice...' };

    case 'SET_MESSAGE':
      return { ...state, message: action.message };

    case 'SCORE': {
      const { player, category } = action;
      if (player !== state.turn || state.rollsLeft === 3 || over || state.scores[player][category] !== undefined) {
        return state;
      }
      const points = calculateScore(state.dice, category, state.scores[player]);
      const nextTurn = player === 'player' ? 'bot' : 'player';
      return {
        ...state,
        ...freshTurn,
        turn: nextTurn,
        scores: { ...state.scores, [player]: { ...state.scores[player], [category]: points } },
        history: [{ id: state.nextHistoryId, player, category, dice: [...state.dice], points }, ...state.history],
        nextHistoryId: state.nextHistoryId + 1,
        message: nextTurn === 'bot' ? 'Bot is thinking...' : 'Your turn! Roll the dice.',
      };
    }

    case 'RESET':
      return { ...initialState, gameId: action.gameId };

    default:
      return state;
  }
};

const isFive = (arr, check) => Array.isArray(arr) && arr.length === 5 && arr.every(check);
const isDie = (d) => Number.isInteger(d) && d >= 1 && d <= 6;
const isPlayer = (p) => p === 'player' || p === 'bot';
const isScoreSheet = (sheet) =>
  sheet !== null && typeof sheet === 'object' &&
  Object.entries(sheet).every(([cat, pts]) => CATEGORIES.includes(cat) && Number.isInteger(pts));
const isHistoryEntry = (e) =>
  e !== null && typeof e === 'object' && Number.isInteger(e.id) && isPlayer(e.player) &&
  CATEGORIES.includes(e.category) && Number.isInteger(e.points) && isFive(e.dice, isDie);

const isValidSave = (s) =>
  s !== null && typeof s === 'object' &&
  isFive(s.dice, isDie) &&
  isFive(s.held, h => typeof h === 'boolean') &&
  isFive(s.diceOrder, i => Number.isInteger(i) && i >= 0 && i < 5) &&
  [0, 1, 2, 3].includes(s.rollsLeft) &&
  isPlayer(s.turn) &&
  s.scores !== null && typeof s.scores === 'object' &&
  isScoreSheet(s.scores.player) && isScoreSheet(s.scores.bot) &&
  typeof s.message === 'string' &&
  Array.isArray(s.history) && s.history.every(isHistoryEntry) &&
  Number.isInteger(s.nextHistoryId);

export const loadGame = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (isValidSave(saved)) {
      const gameId = typeof saved.gameId === 'string' ? saved.gameId : newGameId();
      return { ...initialState, ...saved, gameId, rolling: NO_DICE };
    }
  } catch {
    // Corrupt or inaccessible save - start fresh
  }
  return { ...initialState, gameId: newGameId() };
};

export const saveGame = (state) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, rolling: undefined }));
  } catch {
    // Storage full or disabled - the game still works without saving
  }
};
