import { useReducer, useEffect, useState } from 'react';
import { CATEGORIES, CATEGORY_NAMES, calculateScore, calculateUpperTotal, calculateTotal } from './gameLogic';
import { getBotAction } from './botLogic';
import { gameReducer, loadGame, saveGame, isGameOver as checkGameOver, randomDice, newGameId } from './gameState';
import { loadStats, recordResult, resetStats } from './stats';
import './App.css';

const delay = (ms) => new Promise(res => setTimeout(res, ms));

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

  const renderCategoryRow = (cat, playerKey) => {
    const isAvailable = scores[playerKey][cat] === undefined;
    const showPreview = turn === playerKey && playerKey === 'player' && rollsLeft < 3 && !isGameOver;
    const previewScore = showPreview ? calculateScore(dice, cat, scores[playerKey]) : null;
    const isScorable = isAvailable && showPreview && previewScore > 0;
    
    return (
      <div 
        key={cat} 
        className={`score-row ${isAvailable ? 'open' : 'filled'} ${isScorable ? 'scorable' : ''}`}
        onClick={() => isAvailable && showPreview && dispatch({ type: 'SCORE', player: 'player', category: cat })}
      >
        <span>{CATEGORY_NAMES[cat]}</span>
        <span>
          {!isAvailable 
            ? scores[playerKey][cat] 
            : (showPreview ? previewScore : '-')}
        </span>
      </div>
    );
  };

  const renderScorecard = (playerKey) => {
    const upper = calculateUpperTotal(scores[playerKey]);
    const total = calculateTotal(scores[playerKey]);

    const upperCategories = CATEGORIES.slice(0, 6);
    const lowerCategories = CATEGORIES.slice(6);

    return (
      <div className={`scorecard ${playerKey}`}>
        <h3>{playerKey.toUpperCase()}</h3>
        {upperCategories.map(cat => renderCategoryRow(cat, playerKey))}
        <div className="score-row subtotal">
          <span>Upper Sum</span>
          <span style={{ color: upper.sum >= 63 ? 'var(--success-color)' : 'inherit' }}>{upper.sum} / 63</span>
        </div>
        {lowerCategories.map(cat => renderCategoryRow(cat, playerKey))}
        <div className="score-row bonus"><span>Bonus:</span><span>{upper.bonus}</span></div>
        <div className="score-row total"><span>TOTAL:</span><span>{total}</span></div>
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
        <button className="header-btn stats-btn" onClick={() => setStats(loadStats())}>Stats</button>
        <h1>Yatzy: The General</h1>
        <button
          className="header-btn new-game-btn"
          onClick={() => window.confirm('Start a new game? Current progress will be lost.') && startNewGame()}
        >
          New Game
        </button>
      </div>
      
      <div className="game-status">{isGameOver ? "Game Finished!" : message}</div>
      
      <div className="main-layout">
        <div className="boards-container">
          {renderScorecard('player')}
          {renderScorecard('bot')}
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