import { useReducer, useEffect, useState } from 'react';
import { CATEGORIES, CATEGORY_NAMES, calculateScore, calculateUpperTotal, calculateTotal } from './gameLogic';
import { getBotAction } from './botLogic';
import { gameReducer, loadGame, saveGame, isGameOver as checkGameOver, randomDice, newGameId } from './gameState';
import { loadStats, recordResult, resetStats } from './stats';
import './App.css';

const delay = (ms) => new Promise(res => setTimeout(res, ms));
const LEFT_COLUMN = CATEGORIES.slice(0, 9);
const RIGHT_COLUMN = CATEGORIES.slice(9);

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadGame);
  const [stats, setStats] = useState(null);
  const { dice, held, rolling, diceOrder, rollsLeft, turn, scores, message, history, gameId } = state;
  const isGameOver = checkGameOver(scores);

  let winnerMessage = "";
  let outcome = null;
  if (isGameOver) {
    const pTotal = calculateTotal(scores.player);
    const bTotal = calculateTotal(scores.bot);

    if (pTotal > bTotal) {
      outcome = 'win';
      winnerMessage = `🏆 You win! ${pTotal} to ${bTotal}`;
    } else if (bTotal > pTotal) {
      outcome = 'loss';
      winnerMessage = `🤖 Bot wins! ${bTotal} to ${pTotal}`;
    } else {
      outcome = 'tie';
      winnerMessage = `🤝 It's a tie! ${pTotal} to ${bTotal}`;
    }
  }

  const startNewGame = () => dispatch({ type: 'RESET', gameId: newGameId() });

  useEffect(() => {
    saveGame(state);
  }, [state]);

  useEffect(() => {
    if (outcome) recordResult(gameId, outcome);
  }, [gameId, outcome]);

  useEffect(() => {
    if (!rolling.some(Boolean)) return;
    const timer = setTimeout(() => dispatch({ type: 'ROLL_ANIMATION_END' }), 300);
    return () => clearTimeout(timer);
  }, [rolling]);

  useEffect(() => {
    if (turn !== 'bot' || isGameOver) return;
    // Stops a stale bot step after reset, unmount, or StrictMode's double effect run
    let cancelled = false;
    const wait = async (ms) => {
      await delay(ms);
      return !cancelled;
    };

    const playBotStep = async () => {
      if (rollsLeft === 3) {
        if (await wait(1000)) dispatch({ type: 'ROLL', player: 'bot', values: randomDice() });
        return;
      }

      if (!(await wait(1000))) return;
      const decision = getBotAction(dice, scores.bot, rollsLeft);

      if (decision.action === 'hold') {
        dispatch({ type: 'BOT_HOLD', held: dice.map((_, i) => decision.holdIndices.includes(i)) });
        if (await wait(1000)) dispatch({ type: 'ROLL', player: 'bot', values: randomDice() });
      } else {
        dispatch({ type: 'SET_MESSAGE', message: `Bot scores in ${CATEGORY_NAMES[decision.category]}` });
        if (await wait(1500)) dispatch({ type: 'SCORE', player: 'bot', category: decision.category });
      }
    };

    playBotStep();
    return () => { cancelled = true; };
  }, [turn, rollsLeft, dice, scores, isGameOver]);

  const lastMove = history[0];

  const renderRow = (cat) => {
    const myScore = scores.player[cat];
    const botScore = scores.bot[cat];
    const canPick = myScore === undefined && turn === 'player' && rollsLeft < 3 && !isGameOver;
    const preview = canPick ? calculateScore(dice, cat, scores.player) : null;
    const lastBy = lastMove?.category === cat ? lastMove.player : null;

    return (
      <button
        type="button"
        key={cat}
        className={`board-row ${canPick ? 'pickable' : ''} ${canPick && preview > 0 ? 'scorable' : ''} ${cat === 'sixes' ? 'section-end' : ''}`}
        disabled={!canPick}
        onClick={() => dispatch({ type: 'SCORE', player: 'player', category: cat })}
      >
        <span className="row-label">{CATEGORY_NAMES[cat]}</span>
        <span className={`score-box player ${myScore !== undefined ? 'filled' : (canPick ? 'preview' : 'empty')} ${lastBy === 'player' ? 'last' : ''}`}>
          {myScore ?? (canPick ? preview : '')}
        </span>
        <span className={`score-box bot ${botScore !== undefined ? 'filled' : 'empty'} ${lastBy === 'bot' ? 'last' : ''}`}>
          {botScore ?? ''}
        </span>
      </button>
    );
  };

  const renderColumn = (categories) => (
    <div className="board-column">
      <div className="board-header">
        <span />
        <span className={`col-label player ${turn === 'player' && !isGameOver ? 'active' : ''}`}>Me</span>
        <span className={`col-label bot ${turn === 'bot' && !isGameOver ? 'active' : ''}`}>Bot</span>
      </div>
      {categories.map(renderRow)}
    </div>
  );

  const renderSummary = () => {
    const pUpper = calculateUpperTotal(scores.player);
    const bUpper = calculateUpperTotal(scores.bot);
    const items = [
      { label: 'Upper / 63', me: pUpper.sum, bot: bUpper.sum, meDone: pUpper.sum >= 63, botDone: bUpper.sum >= 63 },
      { label: 'Bonus', me: pUpper.bonus, bot: bUpper.bonus, meDone: pUpper.bonus > 0, botDone: bUpper.bonus > 0 },
      { label: 'Total', me: calculateTotal(scores.player), bot: calculateTotal(scores.bot), className: 'total' },
    ];

    return (
      <div className="board-summary">
        {items.map(item => (
          <div key={item.label} className={`summary-item ${item.className ?? ''}`}>
            <span className="summary-label">{item.label}</span>
            <div className="summary-boxes">
              <div className="summary-cell">
                <span className="summary-who">Me</span>
                <span className={`score-box filled ${item.meDone ? 'achieved' : ''}`}>{item.me}</span>
              </div>
              <div className="summary-cell">
                <span className="summary-who">Bot</span>
                <span className={`score-box filled ${item.botDone ? 'achieved' : ''}`}>{item.bot}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="app-container">
      
      {/* Game Over Modal */}
      {isGameOver && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            <h2>Game Over!</h2>
            <p className="winner-announcement">{winnerMessage}</p>
            <button onClick={startNewGame} className="restart-btn">Play Again</button>
          </div>
        </div>
      )}

      {stats && (
        <div className="game-over-overlay" onClick={() => setStats(null)}>
          <div className="game-over-modal stats-modal" onClick={e => e.stopPropagation()}>
            <h2>Statistics</h2>
            <div className="stats-grid">
              <span>Games played</span><span>{stats.played}</span>
              <span>Wins</span><span>{stats.wins}</span>
              <span>Losses</span><span>{stats.losses}</span>
              <span>Ties</span><span>{stats.ties}</span>
              <span>Win rate</span>
              <span>{stats.played > 0 ? `${Math.round((stats.wins / stats.played) * 100)}%` : '-'}</span>
            </div>
            <div className="stats-actions">
              <button className="restart-btn" onClick={() => setStats(null)}>Close</button>
              <button
                className="header-btn"
                onClick={() => {
                  if (!window.confirm('Reset all statistics?')) return;
                  resetStats();
                  setStats(loadStats());
                }}
              >
                Reset Stats
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="header-container">
        <button
          className="header-btn new-game-btn"
          onClick={() => window.confirm('Start a new game? Current progress will be lost.') && startNewGame()}
        >
          New Game
        </button>
        <h1>Yatzy: The General</h1>
        <button className="header-btn stats-btn" onClick={() => setStats(loadStats())}>Stats</button>
      </div>
      
      <div className="game-status">{isGameOver ? "Game Finished!" : message}</div>
      
      <div className="main-layout">
        <div className="board">
          <div className="board-columns">
            {renderColumn(LEFT_COLUMN)}
            {renderColumn(RIGHT_COLUMN)}
          </div>
          {renderSummary()}
        </div>

        <div className="right-panel">
          <div className="controls-container">
            <div className="dice-container">
              {/* Held dice are sorted to the front, but each die keeps its original index for hold/roll logic */}
              {diceOrder.map(i => (
                  <div
                    key={i}
                    className={`die ${rollsLeft === 3 ? 'unrolled' : (held[i] ? 'held' : '')} ${rolling[i] ? 'rolling' : ''}`}
                    onClick={() => dispatch({ type: 'TOGGLE_HOLD', index: i })}
                  >
                    {rollsLeft === 3 ? '?' : dice[i]}
                  </div>
                ))}
            </div>
            
            <button className="roll-btn" onClick={() => dispatch({ type: 'ROLL', player: 'player', values: randomDice() })} disabled={turn !== 'player' || rollsLeft === 0 || isGameOver}>
              Roll ({rollsLeft} left)
            </button>
          </div>

          <div className="history-container">
            <h3>Match Log</h3>
            <div className="history-list">
              {history.length === 0 ? (
                <div className="history-empty">No actions yet</div>
              ) : (
                history.map(entry => (
                  <div key={entry.id} className={`history-item ${entry.player}`}>
                    <div className="history-header">
                      <span className="history-player">{entry.player.toUpperCase()}</span>
                      <span className="history-points">{entry.points} pts</span>
                    </div>
                    <div className="history-action">{CATEGORY_NAMES[entry.category]}</div>
                    <div className="history-dice">
                      {entry.dice.map((d, i) => (
                        <span key={i} className="mini-die">{d}</span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;