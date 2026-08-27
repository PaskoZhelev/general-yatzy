import { useState, useEffect } from 'react';
import { CATEGORIES, CATEGORY_NAMES, calculateScore, calculateUpperTotal } from './gameLogic';
import { getBotAction } from './botLogic';
import './App.css';

const INITIAL_DICE = [1, 1, 1, 1, 1];
const delay = (ms) => new Promise(res => setTimeout(res, ms));

function App() {
  const [dice, setDice] = useState(INITIAL_DICE);
  const [held, setHeld] = useState([false, false, false, false, false]);
  const [rollingDice, setRollingDice] = useState([false, false, false, false, false]);
  const [rollsLeft, setRollsLeft] = useState(3);
  const [turn, setTurn] = useState('player');
  const [scores, setScores] = useState({ player: {}, bot: {} });
  const [message, setMessage] = useState("Your turn! Roll the dice.");
  const [history, setHistory] = useState([]);

  // Check if every category is filled for both players
  const isGameOver = Object.keys(scores.player).length === CATEGORIES.length && 
                     Object.keys(scores.bot).length === CATEGORIES.length;

  let winnerMessage = "";
  if (isGameOver) {
    const pUpper = calculateUpperTotal(scores.player);
    const bUpper = calculateUpperTotal(scores.bot);
    const pTotal = Object.values(scores.player).reduce((a, b) => a + b, 0) + pUpper.bonus;
    const bTotal = Object.values(scores.bot).reduce((a, b) => a + b, 0) + bUpper.bonus;

    if (pTotal > bTotal) winnerMessage = `🏆 You win! ${pTotal} to ${bTotal}`;
    else if (bTotal > pTotal) winnerMessage = `🤖 Bot wins! ${bTotal} to ${pTotal}`;
    else winnerMessage = `🤝 It's a tie! ${pTotal} to ${bTotal}`;
  }

  const resetGame = () => {
    setScores({ player: {}, bot: {} });
    setDice(INITIAL_DICE);
    setHeld([false, false, false, false, false]);
    setRollingDice([false, false, false, false, false]);
    setRollsLeft(3);
    setTurn('player');
    setMessage("Your turn! Roll the dice.");
    setHistory([]);
  };

  const rollDice = (currentHeld = held) => {
    if (rollsLeft === 0 || isGameOver) return;
    // Briefly flag the non-held dice so the CSS animation can play
    setRollingDice(currentHeld.map(h => !h));
    setDice(prev => prev.map((d, i) => currentHeld[i] ? d : Math.floor(Math.random() * 6) + 1));
    setRollsLeft(prev => prev - 1);
    setTimeout(() => setRollingDice([false, false, false, false, false]), 300);
  };

  const toggleHold = (index) => {
    if (rollsLeft === 3 || turn !== 'player' || isGameOver) return;
    const newHeld = [...held];
    newHeld[index] = !newHeld[index];
    setHeld(newHeld);
  };

  const scoreCategory = (category) => {
    if (scores[turn][category] !== undefined || rollsLeft === 3 || isGameOver) return;
    
    const points = calculateScore(dice, category, scores[turn]);
    
    setHistory(prev => [
      { id: Date.now(), player: turn, category, dice: [...dice], points },
      ...prev
    ]);

    setScores(prev => ({
      ...prev,
      [turn]: { ...prev[turn], [category]: points }
    }));
    
    endTurn();
  };

  const endTurn = () => {
    setHeld([false, false, false, false, false]);
    setRollingDice([false, false, false, false, false]);
    setRollsLeft(3);
    setDice([1, 1, 1, 1, 1]);
    setTurn(turn === 'player' ? 'bot' : 'player');
    setMessage(turn === 'player' ? "Bot is thinking..." : "Your turn! Roll the dice.");
  };

  useEffect(() => {
    const playBotTurn = async () => {
      if (turn !== 'bot' || isGameOver) return;

      if (rollsLeft === 3) {
        await delay(1000);
        rollDice([false, false, false, false, false]);
        return;
      }

      await delay(1000); 
      const decision = getBotAction(dice, scores.bot, rollsLeft);

      if (decision.action === 'hold' && rollsLeft > 0) {
        setMessage(`Bot holds dice...`);
        const newHeld = [false, false, false, false, false];
        decision.holdIndices.forEach(i => newHeld[i] = true);
        setHeld(newHeld);
        
        await delay(1000);
        rollDice(newHeld); 
      } else if (decision.action === 'score') {
        setMessage(`Bot scores in ${CATEGORY_NAMES[decision.category]}`);
        await delay(1500);
        scoreCategory(decision.category);
      }
    };

    playBotTurn();
  }, [turn, rollsLeft, dice, isGameOver]);

  const renderCategoryRow = (cat, playerKey) => {
    const isAvailable = scores[playerKey][cat] === undefined;
    const showPreview = turn === playerKey && playerKey === 'player' && rollsLeft < 3 && !isGameOver;
    const previewScore = showPreview ? calculateScore(dice, cat, scores[playerKey]) : null;
    const isScorable = isAvailable && showPreview && previewScore > 0;
    
    return (
      <div 
        key={cat} 
        className={`score-row ${isAvailable ? 'open' : 'filled'} ${isScorable ? 'scorable' : ''}`}
        onClick={() => isAvailable && showPreview && scoreCategory(cat)}
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
    const total = Object.values(scores[playerKey]).reduce((a, b) => a + b, 0) + upper.bonus;

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
            <button onClick={resetGame} className="restart-btn">Play Again</button>
          </div>
        </div>
      )}

      <div className="header-container">
        <h1>Yatzy: The General</h1>
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
              {dice
                .map((d, i) => i)
                .sort((a, b) => (held[b] ? 1 : 0) - (held[a] ? 1 : 0))
                .map(i => (
                  <div
                    key={i}
                    className={`die ${rollsLeft === 3 ? 'unrolled' : (held[i] ? 'held' : '')} ${rollingDice[i] ? 'rolling' : ''}`}
                    onClick={() => toggleHold(i)}
                  >
                    {rollsLeft === 3 ? '?' : dice[i]}
                  </div>
                ))}
            </div>
            
            <button className="roll-btn" onClick={() => rollDice()} disabled={turn !== 'player' || rollsLeft === 0 || isGameOver}>
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